import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const PAPERS_FETCH_LIMIT = 3000;

interface SavedPaperRow {
  id: string;
  title: string | null;
  authors: string | null;
  year: string | null;
  status: string | null;
  url: string;
}

interface ModelPaperLink {
  id: string;
  paper_id: string;
  created_at: string;
}

interface ModelPaperCitationsProps {
  modelId: string;
  base: string;
}

function paperLabel(p: SavedPaperRow): string {
  const title = (p.title && p.title.trim()) || p.url;
  const meta = [p.authors?.trim(), p.year?.trim()].filter(Boolean).join(', ');
  return meta ? `${title} (${meta})` : title;
}

function statusClassName(status: string | null | undefined): string {
  const normalized = (status || 'Not read').trim().toLowerCase().replace(/\s+/g, '-');
  return `model-paper-status model-paper-status-${normalized}`;
}

function sortLinksByLabel(
  items: (ModelPaperLink & { paper?: SavedPaperRow })[]
): (ModelPaperLink & { paper?: SavedPaperRow })[] {
  return [...items].sort((a, b) => {
    const la = a.paper ? paperLabel(a.paper) : a.paper_id;
    const lb = b.paper ? paperLabel(b.paper) : b.paper_id;
    return la.localeCompare(lb, undefined, { sensitivity: 'base' });
  });
}

export default function ModelPaperCitations({ modelId, base }: ModelPaperCitationsProps) {
  const [papers, setPapers] = useState<SavedPaperRow[]>([]);
  const [links, setLinks] = useState<(ModelPaperLink & { paper?: SavedPaperRow })[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paperById = useMemo(() => {
    const m = new Map<string, SavedPaperRow>();
    papers.forEach((p) => m.set(p.id, p));
    return m;
  }, [papers]);

  const sortedPapers = useMemo(() => {
    return [...papers].sort((a, b) =>
      paperLabel(a).localeCompare(paperLabel(b), undefined, { sensitivity: 'base' })
    );
  }, [papers]);

  const linkedPaperIds = useMemo(() => new Set(links.map((l) => l.paper_id)), [links]);

  const fetchPapers = useCallback(async () => {
    if (!supabase) return;
    setLoadingPapers(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('saved_papers')
      .select('id, title, authors, year, status, url')
      .order('created_at', { ascending: false })
      .limit(PAPERS_FETCH_LIMIT);
    if (fetchError) {
      setError(fetchError.message);
      setPapers([]);
    } else {
      setPapers((data ?? []) as SavedPaperRow[]);
    }
    setLoadingPapers(false);
  }, []);

  const fetchLinks = useCallback(async () => {
    if (!supabase || !modelId) return;
    setLoadingLinks(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('model_papers')
      .select('id, paper_id, created_at')
      .eq('model_id', modelId)
      .order('created_at', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setLinks([]);
      setLoadingLinks(false);
      return;
    }
    const rows = (data ?? []) as ModelPaperLink[];
    const ids = rows.map((r) => r.paper_id);
    if (ids.length === 0) {
      setLinks([]);
      setLoadingLinks(false);
      return;
    }
    const { data: paperRows, error: paperErr } = await supabase
      .from('saved_papers')
      .select('id, title, authors, year, status, url')
      .in('id', ids);
    if (paperErr) {
      setError(paperErr.message);
      setLinks(sortLinksByLabel(rows.map((r) => ({ ...r }))));
    } else {
      const pmap = new Map((paperRows as SavedPaperRow[] | null)?.map((p) => [p.id, p]) ?? []);
      setLinks(
        sortLinksByLabel(rows.map((r) => ({ ...r, paper: pmap.get(r.paper_id) })))
      );
    }
    setLoadingLinks(false);
  }, [modelId]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoadingPapers(false);
      setLoadingLinks(false);
      return;
    }
    fetchPapers();
  }, [fetchPapers]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !modelId) {
      setLoadingLinks(false);
      return;
    }
    fetchLinks();
  }, [modelId, fetchLinks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !modelId || !selectedPaperId) return;
    if (linkedPaperIds.has(selectedPaperId)) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('model_papers')
      .insert({ model_id: modelId, paper_id: selectedPaperId });
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSelectedPaperId('');
    await fetchLinks();
  };

  const handleRemove = async (linkId: string) => {
    if (!supabase) return;
    setRemovingId(linkId);
    setError(null);
    const { error: delError } = await supabase.from('model_papers').delete().eq('id', linkId);
    setRemovingId(null);
    if (delError) {
      setError(delError.message);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="model-paper-citations model-paper-citations-setup">
        <p className="model-paper-citations-hint">
          Add Supabase credentials to link papers from your library to this model.
        </p>
      </div>
    );
  }

  return (
    <div className="model-paper-citations">
      {error && <p className="model-paper-citations-error">{error}</p>}

      <form className="model-paper-citations-form" onSubmit={handleAdd}>
        <label className="model-paper-citations-label" htmlFor={`model-paper-select-${modelId}`}>
          Link a paper from your library
        </label>
        <div className="model-paper-citations-row">
          <select
            id={`model-paper-select-${modelId}`}
            className="model-paper-citations-select"
            value={selectedPaperId}
            onChange={(e) => setSelectedPaperId(e.target.value)}
            disabled={loadingPapers || adding}
          >
            <option value="">— Select a paper —</option>
            {sortedPapers.map((p) => (
              <option key={p.id} value={p.id} disabled={linkedPaperIds.has(p.id)}>
                {paperLabel(p)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="model-paper-citations-add"
            disabled={!selectedPaperId || adding || linkedPaperIds.has(selectedPaperId)}
          >
            {adding ? 'Adding…' : 'Add link'}
          </button>
        </div>
        {loadingPapers && <p className="model-paper-citations-loading">Loading papers…</p>}
      </form>

      {loadingLinks ? (
        <p className="model-paper-citations-loading">Loading linked papers…</p>
      ) : links.length > 0 ? (
        <ul className="model-paper-citations-list">
          {links.map((link) => {
            const p = link.paper ?? paperById.get(link.paper_id);
            const href = `${base}papers/detail/?id=${link.paper_id}`;
            const title = (p?.title && p.title.trim()) || (p?.url ?? `Paper ${link.paper_id.slice(0, 8)}…`);
            const meta = [p?.authors?.trim(), p?.year?.trim()].filter(Boolean).join(' · ');
            const status = (p?.status && p.status.trim()) || 'Not read';
            return (
              <li key={link.id} className="model-paper-citations-item">
                <article className="model-paper-card">
                  <div className="model-paper-card-header">
                    <span className={statusClassName(status)}>{status}</span>
                    <button
                      type="button"
                      className="model-paper-citations-remove"
                      onClick={() => handleRemove(link.id)}
                      disabled={removingId === link.id}
                      title="Remove link"
                    >
                      {removingId === link.id ? '…' : 'Remove'}
                    </button>
                  </div>
                  <h5 className="model-paper-card-title">
                    <a href={href} className="model-paper-citations-link">
                      {title}
                    </a>
                  </h5>
                  {meta && <p className="model-paper-card-meta">{meta}</p>}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="model-paper-citations-empty">No papers linked yet. Choose one above.</p>
      )}
    </div>
  );
}
