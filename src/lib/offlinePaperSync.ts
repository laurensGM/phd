import { supabase, isSupabaseConfigured } from './supabase';
import { cacheNarrationAudio } from './narration/narrationCache';
import {
  getOfflinePaper,
  notifyOfflinePapersChanged,
  saveOfflinePaper,
  type OfflinePaperBundle,
  type OfflinePaperRecord,
  type OfflineSummaryRecord,
} from './offlinePaperStore';

function toOfflinePaperRecord(row: Record<string, unknown>): OfflinePaperRecord {
  const citations = row.citations;
  let citationsNum: number | null = null;
  if (citations != null) {
    const n = typeof citations === 'number' ? citations : parseInt(String(citations), 10);
    citationsNum = Number.isNaN(n) ? null : n;
  }
  return {
    id: String(row.id),
    url: String(row.url),
    secondary_url: (row.secondary_url as string | null) ?? null,
    motivation: (row.motivation as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    title: (row.title as string | null) ?? null,
    authors: (row.authors as string | null) ?? null,
    year: (row.year as string | null) ?? null,
    journal: (row.journal as string | null) ?? null,
    citations: citationsNum,
    status: String(row.status ?? 'Not read'),
    golden: !!row.golden,
    created_at: String(row.created_at),
  };
}

/** Mark paper for offline in Supabase so other devices can sync while online. */
export async function markPaperSavedForOfflineInCloud(paperId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured() || !navigator.onLine) return;
  await supabase
    .from('saved_papers')
    .update({ saved_for_offline_at: new Date().toISOString() })
    .eq('id', paperId);
}

/** True if saved locally or flagged for offline in Supabase. */
export async function isPaperSavedForOffline(paperId: string): Promise<boolean> {
  if (await getOfflinePaper(paperId)) return true;
  if (!supabase || !isSupabaseConfigured() || !navigator.onLine) return false;
  const { data } = await supabase
    .from('saved_papers')
    .select('saved_for_offline_at')
    .eq('id', paperId)
    .maybeSingle();
  return !!data?.saved_for_offline_at;
}

/**
 * Download papers flagged for offline in Supabase into this device's IndexedDB (+ audio cache).
 * Call while online on each device (e.g. Papers page load).
 */
export async function syncOfflinePapersFromCloud(): Promise<void> {
  if (!supabase || !isSupabaseConfigured() || !navigator.onLine) return;

  const { data: papers, error } = await supabase
    .from('saved_papers')
    .select('*')
    .not('saved_for_offline_at', 'is', null);

  if (error || !papers?.length) return;

  const paperIds = papers.map((p) => p.id as string);
  const { data: summaries } = await supabase.from('paper_summary').select('*').in('paper_id', paperIds);

  const summaryByPaperId = new Map<string, OfflineSummaryRecord>();
  for (const s of summaries ?? []) {
    summaryByPaperId.set(s.paper_id as string, s as OfflineSummaryRecord);
  }

  let changed = false;

  for (const row of papers) {
    const paperId = row.id as string;
    const cloudSavedAt = row.saved_for_offline_at as string;
    const local = await getOfflinePaper(paperId);
    const summary = summaryByPaperId.get(paperId) ?? null;

    const cloudIsNewer =
      !local || new Date(cloudSavedAt).getTime() > new Date(local.savedAt).getTime();

    if (cloudIsNewer) {
      const bundle: OfflinePaperBundle = {
        paperId,
        paper: toOfflinePaperRecord(row as Record<string, unknown>),
        summary,
        savedAt: cloudSavedAt,
      };
      await saveOfflinePaper(bundle);
      changed = true;
    }

    if (summary?.narration_url) {
      await cacheNarrationAudio(summary.narration_url);
    }
  }

  if (changed) notifyOfflinePapersChanged();
}
