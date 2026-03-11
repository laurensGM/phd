import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SavedPaper {
  id: string;
  url: string;
  secondary_url: string | null;
  motivation: string | null;
  tags: string[];
  title: string | null;
  authors: string | null;
  year: string | null;
  citations: number | null;
  status: string;
  golden: boolean;
  created_at: string;
}

const PAPER_STATUSES = [
  { id: 'Not read', label: 'Not read' },
  { id: '1st reading', label: '1st reading' },
  { id: '2nd reading', label: '2nd reading' },
  { id: 'Read', label: 'Read' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Archive', label: 'Archive' },
] as const;

function mapRow(row: {
  id: string;
  url: string;
  secondary_url?: string | null;
  motivation: string | null;
  tags: string[] | null;
  title?: string | null;
  authors?: string | null;
  year?: string | null;
  citations?: number | null;
  status?: string | null;
  golden?: boolean | null;
  created_at: string;
}): SavedPaper {
  const status = row.status?.trim() && PAPER_STATUSES.some((s) => s.id === row.status) ? row.status! : 'Not read';
  return {
    id: row.id,
    url: row.url,
    secondary_url: row.secondary_url ?? null,
    motivation: row.motivation ?? null,
    tags: row.tags ?? [],
    title: row.title ?? null,
    authors: row.authors ?? null,
    year: row.year ?? null,
    citations: (() => {
      const c = row.citations;
      if (c === null || c === undefined) return null;
      const n = typeof c === 'number' ? c : parseInt(String(c), 10);
      return Number.isNaN(n) ? null : n;
    })(),
    status,
    golden: !!row.golden,
    created_at: row.created_at,
  };
}

/** Extract DOI from URL for APA 7 "https://doi.org/xxx" ending */
function extractDoi(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(/doi\.org\/(10\.\S+)/i) || url.trim().match(/^(10\.\d+\/\S+)/);
  if (!m) return null;
  return m[1].replace(/#.*$/, '').trim();
}

/**
 * Format authors string into APA 7 style: "Author, A. A., & Author, B. B."
 * Handles "Last, F.; Last2, F." or "Last, F., Last2, F." or plain "Last, F."
 */
function formatAuthorsAPA7(authors: string | null | undefined): string {
  if (!authors || !authors.trim()) return '';
  const parts = authors
    .split(/[;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, & ${parts[1]}`;
  return parts.slice(0, -1).join(', ') + ', & ' + parts[parts.length - 1];
}

/**
 * Generate APA 7 reference (simplified for journal/article or web source).
 * Format: Author(s). (Year). Title. URL or https://doi.org/xxx
 */
function buildAPA7Citation(paper: SavedPaper): string {
  const authors = formatAuthorsAPA7(paper.authors);
  const year = paper.year?.trim() || 'n.d.';
  const title = paper.title?.trim() || 'Untitled';
  const doi = extractDoi(paper.url);
  const urlPart = doi ? `https://doi.org/${doi}` : paper.url?.trim() || '';
  const end = urlPart ? (doi ? urlPart : `Retrieved from ${urlPart}`) : '';
  if (!authors && year === 'n.d.' && !title) return '';

  const authorPart = authors ? `${authors}. ` : '';
  const yearPart = `(${year}). `;
  const titlePart = `${title}. `;
  return (authorPart + yearPart + titlePart + (end ? end : '')).trim().replace(/\s+\.$/, '.');
}

export default function PaperDetailPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [paper, setPaper] = useState<SavedPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const getIdFromUrl = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }, []);

  useEffect(() => {
    const id = getIdFromUrl();
    if (!id) {
      setError('No paper ID in URL. Use the Papers list and click a paper to open its details.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase!
        .from('saved_papers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setPaper(null);
      } else if (data) {
        setPaper(mapRow(data as Parameters<typeof mapRow>[0]));
      } else {
        setError('Paper not found.');
        setPaper(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdFromUrl]);

  const citation = paper ? buildAPA7Citation(paper) : '';
  const handleCopyCitation = useCallback(() => {
    if (!citation) return;
    navigator.clipboard.writeText(citation).then(
      () => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      },
      () => {}
    );
  }, [citation]);

  if (loading) {
    return (
      <div className="paper-detail-page">
        <p className="paper-detail-loading">Loading paper…</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="paper-detail-page">
        <a href={`${base}papers/`} className="paper-detail-back">← Back to Papers</a>
        <p className="paper-detail-error">{error || 'Paper not found.'}</p>
      </div>
    );
  }

  return (
    <div className="paper-detail-page">
      <a href={`${base}papers/`} className="paper-detail-back">← Back to Papers</a>

      <header className="paper-detail-header">
        <h1 className="paper-detail-title">{paper.title || 'Untitled'}</h1>
        {paper.authors && <p className="paper-detail-authors">{paper.authors}</p>}
        {(paper.year || paper.status) && (
          <div className="paper-detail-meta-row">
            {paper.year && <span className="paper-detail-year">{paper.year}</span>}
            {paper.status && (
              <span className={`paper-detail-status paper-detail-status-${paper.status.replace(/\s+/g, '-').toLowerCase()}`}>
                {paper.status}
              </span>
            )}
            {paper.golden && <span className="paper-detail-golden">Golden</span>}
          </div>
        )}
      </header>

      <section className="paper-detail-section">
        <h2 className="paper-detail-section-title">Links</h2>
        <p>
          <a href={paper.url} target="_blank" rel="noopener noreferrer" className="paper-detail-link">
            Open paper
          </a>
          {paper.secondary_url && (
            <>
              {' · '}
              <a href={paper.secondary_url} target="_blank" rel="noopener noreferrer" className="paper-detail-link">
                Secondary link
              </a>
            </>
          )}
        </p>
      </section>

      {paper.motivation && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Why I saved this</h2>
          <p className="paper-detail-motivation">{paper.motivation}</p>
        </section>
      )}

      {paper.tags.length > 0 && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Tags</h2>
          <div className="paper-detail-tags">
            {paper.tags.map((t) => (
              <span key={t} className="paper-detail-tag">{t}</span>
            ))}
          </div>
        </section>
      )}

      {(paper.citations != null && paper.citations !== undefined) && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Citations</h2>
          <p className="paper-detail-citations">{paper.citations}</p>
        </section>
      )}

      <section className="paper-detail-section paper-detail-apa-section">
        <h2 className="paper-detail-section-title">APA 7 reference</h2>
        <p className="paper-detail-apa-hint">
          Use this reference in your bibliography. You can copy it and paste into your document.
        </p>
        <div className="paper-detail-apa-box">
          <output className="paper-detail-apa-output" aria-live="polite">
            {citation || 'Add title, authors, and year in the paper edit form to generate a citation.'}
          </output>
          {citation && (
            <button type="button" className="paper-detail-apa-copy" onClick={handleCopyCitation}>
              {copyFeedback ? 'Copied!' : 'Copy citation'}
            </button>
          )}
        </div>
      </section>

      <p className="paper-detail-created">
        Saved on {new Date(paper.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
