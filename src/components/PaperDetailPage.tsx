import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';

interface SavedPaper {
  id: string;
  url: string;
  secondary_url: string | null;
  motivation: string | null;
  tags: string[];
  title: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
  citations: number | null;
  status: string;
  golden: boolean;
  created_at: string;
}

interface Snippet {
  id: string;
  paper_id: string;
  construct_id: string | null;
  model_id: string | null;
  content: string;
  notes: string | null;
  tags: string[];
  page_number: number | null;
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
  journal?: string | null;
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
    journal: row.journal ?? null,
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

const constructOptions = (constructsData as any[]).map((c) => ({
  id: c.id as string,
  name: (c.name as string) || (c.id as string),
}));

const modelOptions = (modelsData as any[]).map((m) => ({
  id: m.id as string,
  name: (m.name as string) || (m.id as string),
}));

export default function PaperDetailPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [paper, setPaper] = useState<SavedPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [newSnippetConstructId, setNewSnippetConstructId] = useState('');
  const [newSnippetModelId, setNewSnippetModelId] = useState('');
  const [newSnippetPageNumber, setNewSnippetPageNumber] = useState<string>('');
  const [newSnippetTagsInput, setNewSnippetTagsInput] = useState('');
  const [allSnippetTags, setAllSnippetTags] = useState<string[]>([]);

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
        // Load snippets once the paper is known
        const row = data as Parameters<typeof mapRow>[0];
        const paperId = row.id;
        setSnippetsLoading(true);
        const loadSnippets = async () => {
          const { data: snippetData, error: snippetErr } = await supabase!
            .from('snippets')
            .select('*')
            .eq('paper_id', paperId)
            .order('created_at', { ascending: false });
          if (snippetErr) {
            setSnippetError(snippetErr.message);
            setSnippets([]);
          } else {
            setSnippetError(null);
            const list = (snippetData ?? []) as Snippet[];
            setSnippets(list);
            const tagSet = new Set<string>();
            for (const s of list) {
              if (Array.isArray(s.tags)) {
                for (const t of s.tags) {
                  if (t && typeof t === 'string') tagSet.add(t);
                }
              }
            }
            setAllSnippetTags(Array.from(tagSet));
          }
          setSnippetsLoading(false);
        };
        loadSnippets();
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

  const handleAddSnippet = useCallback(async () => {
    if (!paper || !newSnippetContent.trim()) return;
    if (!supabase || !isSupabaseConfigured()) return;
    setSnippetsLoading(true);
    setSnippetError(null);
    const pageNum = newSnippetPageNumber.trim() ? parseInt(newSnippetPageNumber, 10) : null;
    const rawTags = newSnippetTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const existingByLower = allSnippetTags.reduce<Record<string, string>>((acc, t) => {
      acc[t.toLowerCase()] = t;
      return acc;
    }, {});
    const snippetTags: string[] = [];
    for (const t of rawTags) {
      const key = t.toLowerCase();
      const canonical = existingByLower[key] ?? t;
      if (!snippetTags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
        snippetTags.push(canonical);
      }
    }
    const payload: Omit<Snippet, 'id' | 'created_at'> & { id?: string; created_at?: string } = {
      paper_id: paper.id,
      construct_id: newSnippetConstructId.trim() || null,
      model_id: newSnippetModelId.trim() || null,
      content: newSnippetContent.trim(),
      notes: null,
      tags: snippetTags,
      page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
    };
    const { data, error: insertError } = await supabase
      .from('snippets')
      .insert(payload)
      .select('*')
      .single();
    if (insertError) {
      setSnippetError(insertError.message);
    } else if (data) {
      const inserted = data as Snippet;
      setSnippets((prev) => [inserted, ...prev]);
      if (Array.isArray(inserted.tags)) {
        setAllSnippetTags((prev) => {
          const set = new Set(prev);
          for (const t of inserted.tags) {
            if (t && typeof t === 'string') set.add(t);
          }
          return Array.from(set);
        });
      }
      setNewSnippetContent('');
      setNewSnippetConstructId('');
      setNewSnippetModelId('');
      setNewSnippetPageNumber('');
      setNewSnippetTagsInput('');
    }
    setSnippetsLoading(false);
  }, [paper, newSnippetContent, newSnippetConstructId, newSnippetModelId, newSnippetPageNumber, newSnippetTagsInput, allSnippetTags]);

  const handleDeleteSnippet = useCallback(
    async (id: string) => {
      if (!supabase || !isSupabaseConfigured()) return;
      const confirmed = window.confirm('Delete this snippet?');
      if (!confirmed) return;
      setSnippetsLoading(true);
      setSnippetError(null);
      const { error: deleteError } = await supabase.from('snippets').delete().eq('id', id);
      if (deleteError) {
        setSnippetError(deleteError.message);
      } else {
        setSnippets((prev) => prev.filter((s) => s.id !== id));
      }
      setSnippetsLoading(false);
    },
    []
  );

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
        {(paper.year || paper.journal || paper.status) && (
          <div className="paper-detail-meta-row">
            {paper.year && <span className="paper-detail-year">{paper.year}</span>}
            {paper.journal && <span className="paper-detail-journal">{paper.journal}</span>}
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

      <section className="paper-detail-section paper-detail-snippets">
        <h2 className="paper-detail-section-title">Snippets from this paper</h2>
        <p className="paper-detail-snippets-hint">
          Capture key ideas or quotes here and optionally link them to constructs or models so you can reuse them later.
        </p>
        <div className="paper-detail-snippet-form">
          <label className="paper-detail-snippet-label">
            Snippet text
            <textarea
              className="paper-detail-snippet-input"
              value={newSnippetContent}
              onChange={(e) => setNewSnippetContent(e.target.value)}
              rows={3}
              placeholder="Paste or type the key idea, quote, or conceptual snippet from this paper…"
            />
          </label>
          <div className="paper-detail-snippet-meta-row">
            <label className="paper-detail-snippet-label-inline">
              Construct (optional)
              <select
                className="paper-detail-snippet-input-inline"
                value={newSnippetConstructId}
                onChange={(e) => setNewSnippetConstructId(e.target.value)}
              >
                <option value="">None</option>
                {constructOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="paper-detail-snippet-label-inline">
              Model (optional)
              <select
                className="paper-detail-snippet-input-inline"
                value={newSnippetModelId}
                onChange={(e) => setNewSnippetModelId(e.target.value)}
              >
                <option value="">None</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="paper-detail-snippet-label-inline">
              Page number (optional)
              <input
                type="number"
                min={1}
                className="paper-detail-snippet-input-inline paper-detail-snippet-page-input"
                value={newSnippetPageNumber}
                onChange={(e) => setNewSnippetPageNumber(e.target.value)}
                placeholder="e.g. 12"
              />
            </label>
            <label className="paper-detail-snippet-label-inline">
              Tags (optional)
              <input
                type="text"
                list="snippet-tags-list"
                className="paper-detail-snippet-input-inline paper-detail-snippet-tags-input"
                value={newSnippetTagsInput}
                onChange={(e) => setNewSnippetTagsInput(e.target.value)}
                placeholder="e.g. method, theory"
              />
            </label>
          </div>
          <datalist id="snippet-tags-list">
            {allSnippetTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="button"
            className="paper-detail-snippet-add"
            onClick={handleAddSnippet}
            disabled={!newSnippetContent.trim() || snippetsLoading}
          >
            {snippetsLoading ? 'Saving snippet…' : 'Add snippet'}
          </button>
          {snippetError && <p className="paper-detail-snippet-error">{snippetError}</p>}
        </div>

        <div className="paper-detail-snippet-list">
          {snippetsLoading && snippets.length === 0 && (
            <p className="paper-detail-snippet-empty">Loading snippets…</p>
          )}
          {!snippetsLoading && snippets.length === 0 && !snippetError && (
            <p className="paper-detail-snippet-empty">No snippets yet. Add your first snippet from this paper above.</p>
          )}
          {snippets.map((s) => (
            <article key={s.id} className="paper-detail-snippet-card">
              <p className="paper-detail-snippet-content">{s.content}</p>
              {(s.page_number != null || s.construct_id || s.model_id) && (
                <div className="paper-detail-snippet-meta">
                  {s.page_number != null && (
                    <span className="paper-detail-snippet-page">Page {s.page_number}</span>
                  )}
                  {(s.construct_id || s.model_id) && (
                <div className="paper-detail-snippet-links">
                  {s.construct_id && (
                    <a
                      href={`${base}constructs/${s.construct_id}/`}
                      className="paper-detail-snippet-chip"
                    >
                      Construct: {s.construct_id}
                    </a>
                  )}
                  {s.model_id && (
                    <a
                      href={`${base}models/${s.model_id}/`}
                      className="paper-detail-snippet-chip"
                    >
                      Model: {s.model_id}
                    </a>
                  )}
                </div>
                  )}
                </div>
              )}
              {Array.isArray(s.tags) && s.tags.length > 0 && (
                <div className="paper-detail-snippet-tags">
                  {s.tags.map((tag) => (
                    <span key={tag} className="paper-detail-snippet-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="paper-detail-snippet-footer">
                <span className="paper-detail-snippet-date">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  className="paper-detail-snippet-delete"
                  onClick={() => handleDeleteSnippet(s.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

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
