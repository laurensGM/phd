import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { hasNarratableSummary, type NarrationSummaryInput } from '../lib/narration/buildNarrationScript';
import { narrationContentHash } from '../lib/narration/narrationHash';
import {
  cacheNarrationAudio,
  getCachedNarrationUrl,
  isNarrationCached,
} from '../lib/narration/narrationCache';

interface Props {
  paperId: string;
  paperTitle?: string | null;
  paperAuthors?: string | null;
  paperYear?: string | null;
  summary: NarrationSummaryInput & {
    narration_url?: string | null;
    narration_content_hash?: string | null;
  } | null;
  onNarrationUpdated?: (url: string, hash: string) => void;
  onSaveOffline?: () => Promise<boolean>;
  offlineSaved?: boolean;
}

type PlayerStatus = 'idle' | 'generating' | 'loading' | 'ready' | 'playing' | 'error';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SummaryNarrationPlayer({
  paperId,
  paperTitle,
  paperAuthors,
  paperYear,
  summary,
  onNarrationUpdated,
  onSaveOffline,
  offlineSaved = false,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [needsRegenerate, setNeedsRegenerate] = useState(false);
  const [hashChecked, setHashChecked] = useState(false);

  const paperMeta = { title: paperTitle, authors: paperAuthors, year: paperYear };

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => revokeBlob();
  }, [revokeBlob]);

  useEffect(() => {
    setHashChecked(false);
    setOfflineReady(offlineSaved);
    revokeBlob();
    setAudioSrc(null);
    setStatus('idle');
  }, [paperId, revokeBlob, offlineSaved]);

  useEffect(() => {
    if (!summary || !hasNarratableSummary(summary)) {
      setNeedsRegenerate(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const hash = await narrationContentHash(summary, paperMeta);
      if (cancelled) return;
      const stale =
        !summary.narration_url ||
        !summary.narration_content_hash ||
        summary.narration_content_hash !== hash;
      setNeedsRegenerate(stale);
      setHashChecked(true);
      if (summary.narration_url && !stale) {
        const cached = await isNarrationCached(summary.narration_url);
        if (!cancelled) setOfflineReady(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summary, paperTitle, paperAuthors, paperYear]);

  const resolveAudioUrl = useCallback(
    async (url: string): Promise<string> => {
      const cached = await getCachedNarrationUrl(url);
      if (cached) {
        blobUrlRef.current = cached;
        setOfflineReady(true);
        return cached;
      }
      await cacheNarrationAudio(url);
      const afterCache = await getCachedNarrationUrl(url);
      if (afterCache) {
        blobUrlRef.current = afterCache;
        setOfflineReady(true);
        return afterCache;
      }
      setOfflineReady(false);
      return url;
    },
    []
  );

  const prepareNarration = useCallback(
    async (force = false) => {
      if (!summary || !hasNarratableSummary(summary)) return;
      if (!supabase || !isSupabaseConfigured()) {
        setError('Supabase is not configured.');
        setStatus('error');
        return;
      }

      setError(null);
      setStatus('generating');

      try {
        const { data, error: fnErr } = await supabase.functions.invoke('generate-paper-narration', {
          body: { paper_id: paperId, force },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Narration failed');

        const url = data?.narration_url as string | undefined;
        const hash = data?.narration_content_hash as string | undefined;
        if (!url) throw new Error('No narration URL returned');

        onNarrationUpdated?.(url, hash ?? '');
        setNeedsRegenerate(false);
        setStatus('loading');

        revokeBlob();
        const src = await resolveAudioUrl(url);
        setAudioSrc(src);
        setStatus('ready');
      } catch (e) {
        setError((e as Error)?.message ?? 'Could not generate narration');
        setStatus('error');
      }
    },
    [summary, paperId, onNarrationUpdated, resolveAudioUrl, revokeBlob]
  );

  const loadExisting = useCallback(async () => {
    if (!summary?.narration_url || needsRegenerate) return;
    setError(null);
    setStatus('loading');
    try {
      revokeBlob();
      const src = await resolveAudioUrl(summary.narration_url);
      setAudioSrc(src);
      setStatus('ready');
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not load narration');
      setStatus('error');
    }
  }, [summary?.narration_url, needsRegenerate, resolveAudioUrl, revokeBlob]);

  useEffect(() => {
    if (!hashChecked) return;
    if (!summary || !hasNarratableSummary(summary)) {
      setAudioSrc(null);
      setStatus('idle');
      return;
    }
    if (summary.narration_url && !needsRegenerate) {
      loadExisting();
    } else {
      setAudioSrc(null);
      setStatus('idle');
    }
  }, [hashChecked, summary, needsRegenerate, loadExisting]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      if (!audioSrc) await prepareNarration(false);
      return;
    }
    if (audio.paused) {
      await audio.play();
      setStatus('playing');
    } else {
      audio.pause();
      setStatus('ready');
    }
  }, [audioSrc, prepareNarration]);

  const handleDownloadOffline = useCallback(async () => {
    if (onSaveOffline) {
      setStatus('loading');
      setError(null);
      try {
        const ok = await onSaveOffline();
        setOfflineReady(ok);
        if (!ok) {
          setError('Could not save for offline. Check your connection and try again.');
          setStatus('error');
          return;
        }
        if (summary?.narration_url) {
          revokeBlob();
          const src = await getCachedNarrationUrl(summary.narration_url);
          if (src) {
            blobUrlRef.current = src;
            setAudioSrc(src);
          }
        }
        setStatus(audioRef.current && !audioRef.current.paused ? 'playing' : 'ready');
      } catch (e) {
        setError((e as Error)?.message ?? 'Could not save for offline');
        setStatus('error');
      }
      return;
    }

    if (!summary?.narration_url) {
      await prepareNarration(false);
      return;
    }
    setStatus('loading');
    await cacheNarrationAudio(summary.narration_url);
    const cached = await isNarrationCached(summary.narration_url);
    setOfflineReady(cached);
    if (cached && audioSrc && !audioSrc.startsWith('blob:')) {
      revokeBlob();
      const src = await getCachedNarrationUrl(summary.narration_url);
      if (src) {
        blobUrlRef.current = src;
        setAudioSrc(src);
      }
    }
    setStatus(audioRef.current && !audioRef.current.paused ? 'playing' : 'ready');
  }, [onSaveOffline, summary?.narration_url, prepareNarration, audioSrc, revokeBlob]);

  if (!summary || !hasNarratableSummary(summary)) return null;

  const showGenerate = !audioSrc || needsRegenerate || status === 'error';
  const busy = status === 'generating' || status === 'loading';

  return (
    <div className="summary-narration" aria-label="Summary audio narration">
      <div className="summary-narration-header">
        <span className="summary-narration-icon" aria-hidden="true">
          🎧
        </span>
        <div className="summary-narration-meta">
          <strong className="summary-narration-title">Listen to summary</strong>
          <span className="summary-narration-sub">
            Indian English narration · {offlineReady ? 'Saved for offline' : 'Save paper + audio for offline'}
          </span>
        </div>
      </div>

      {error && <p className="summary-narration-error">{error}</p>}
      {needsRegenerate && !busy && (
        <p className="summary-narration-hint">Summary changed — generate a fresh narration.</p>
      )}

      <div className="summary-narration-controls">
        {showGenerate ? (
          <button
            type="button"
            className="summary-narration-btn summary-narration-btn-primary"
            onClick={() => prepareNarration(needsRegenerate)}
            disabled={busy}
          >
            {busy ? 'Preparing audio…' : needsRegenerate ? 'Regenerate narration' : 'Generate narration'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="summary-narration-btn summary-narration-btn-primary"
              onClick={togglePlay}
              disabled={busy}
              aria-label={status === 'playing' ? 'Pause' : 'Play'}
            >
              {status === 'playing' ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="summary-narration-btn summary-narration-btn-secondary"
              onClick={handleDownloadOffline}
              disabled={busy}
            >
              {offlineReady ? 'Saved offline' : 'Save offline'}
            </button>
            {needsRegenerate && (
              <button
                type="button"
                className="summary-narration-btn summary-narration-btn-secondary"
                onClick={() => prepareNarration(true)}
                disabled={busy}
              >
                Regenerate
              </button>
            )}
          </>
        )}
      </div>

      {audioSrc && (
        <>
          <audio
            ref={audioRef}
            src={audioSrc}
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setStatus('ready')}
            onPlay={() => setStatus('playing')}
            onPause={() => setStatus('ready')}
          />
          <div className="summary-narration-progress">
            <input
              type="range"
              className="summary-narration-seek"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => {
                const t = parseFloat(e.target.value);
                if (audioRef.current) {
                  audioRef.current.currentTime = t;
                  setCurrentTime(t);
                }
              }}
              aria-label="Playback position"
            />
            <span className="summary-narration-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
