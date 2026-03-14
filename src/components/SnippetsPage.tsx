import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';

const SNIPPET_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'definition', label: 'Definition' },
  { value: 'theory', label: 'Theory' },
  { value: 'empirical finding', label: 'Empirical finding' },
  { value: 'method', label: 'Method' },
  { value: 'limitation', label: 'Limitation' },
  { value: 'future research', label: 'Future research' },
] as const;

interface Snippet {
  id: string;
  paper_id: string;
  construct_id: string | null;
  model_id: string | null;
  content: string;
  notes: string | null;
  tags: string[];
  page_number: number | null;
  snippet_type: string | null;
  created_at: string;
}

interface PaperSummary {
  id: string;
  title: string | null;
  url: string;
  journal: string | null;
}

const constructOptions = (constructsData as any[]).map((c) => ({
  id: c.id as string,
  name: (c.name as string) || (c.id as string),
  abbreviation: (c.abbreviation as string | undefined) ?? undefined,
}));

const modelOptions = (modelsData as any[]).map((m) => ({
  id: m.id as string,
  name: (m.name as string) || (m.id as string),
}));

/** Flatten ids so comma-separated values in any element become separate ids (fixes legacy "id1,id2" in one cell). */
function flattenIds(ids: string[]): string[] {
  return ids.flatMap((id) =>
    id.includes(',') ? id.split(',').map((x) => x.trim()).filter(Boolean) : [id]
  );
}

/** Normalize snippet construct ids: use construct_id when construct_ids is empty (e.g. extension-only payload). */
function getSnippetConstructIds(s: any): string[] {
  const raw = s.construct_ids ?? s.construct_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw as string[]);
  if (typeof raw === 'string' && raw) return flattenIds(raw.split(',').map((x: string) => x.trim()).filter(Boolean));
  return s.construct_id ? flattenIds([s.construct_id]) : [];
}

/** Normalize snippet model ids: use model_id when model_ids is empty (e.g. extension-only payload). */
function getSnippetModelIds(s: any): string[] {
  const raw = s.model_ids ?? s.model_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw as string[]);
  if (typeof raw === 'string' && raw) return flattenIds(raw.split(',').map((x: string) => x.trim()).filter(Boolean));
  return s.model_id ? flattenIds([s.model_id]) : [];
}

export default function SnippetsPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterPaperId, setFilterPaperId] = useState('');
  const [filterJournalNames, setFilterJournalNames] = useState<string[]>([]);
  const [filterConstructIds, setFilterConstructIds] = useState<string[]>([]);
  const [filterModelIds, setFilterModelIds] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [search, setSearch] = useState('');

  const [newContent, setNewContent] = useState('');
  const [newPaperId, setNewPaperId] = useState('');
  const [newConstructId, setNewConstructId] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newPageNumber, setNewPageNumber] = useState<string>('');
  const [newTagsInput, setNewTagsInput] = useState('');
  const [newSnippetType, setNewSnippetType] = useState('');

  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editConstructId, setEditConstructId] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editPageNumber, setEditPageNumber] = useState<string>('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editSnippetType, setEditSnippetType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [{ data: snippetData, error: snippetErr }, { data: papersData, error: papersErr }] =
        await Promise.all([
          supabase!
            .from('snippets')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase!.from('saved_papers').select('id,title,url,journal'),
        ]);
      if (cancelled) return;
      if (snippetErr) {
        setError(snippetErr.message);
        setSnippets([]);
      } else {
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
        setAllTags(Array.from(tagSet));
      }
      if (papersErr) {
        // keep error but still show snippets
        setError((prev) => prev ?? papersErr.message);
        setPapers([]);
      } else {
        setPapers(
          (papersData ?? []).map((p: any) => ({
            id: p.id as string,
            title: (p.title as string | null) ?? null,
            url: p.url as string,
            journal: (p.journal as string | null) ?? null,
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const paperById = useMemo(() => {
    const map = new Map<string, PaperSummary>();
    for (const p of papers) map.set(p.id, p);
    return map;
  }, [papers]);

  const allJournals = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => {
      if (p.journal && p.journal.trim()) set.add(p.journal.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [papers]);

  const paperSnippetCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => map.set(s.paper_id, (map.get(s.paper_id) ?? 0) + 1));
    return map;
  }, [snippets]);

  const papersSortedByCount = useMemo(() => {
    return [...papers].sort((a, b) => (paperSnippetCounts.get(b.id) ?? 0) - (paperSnippetCounts.get(a.id) ?? 0));
  }, [papers, paperSnippetCounts]);

  const constructSnippetCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => {
      const raw: string[] = getSnippetConstructIds(s);
      const ids = raw
        .map((val) => {
          const match = constructOptions.find(
            (opt) =>
              opt.id === val ||
              opt.name.toLowerCase() === val.toLowerCase() ||
              (opt.abbreviation && opt.abbreviation.toLowerCase() === val.toLowerCase())
          );
          return match ? match.id : val;
        })
        .filter(Boolean);
      ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [snippets]);

  const constructOptionsSortedByCount = useMemo(() => {
    return [...constructOptions].sort((a, b) => (constructSnippetCounts.get(b.id) ?? 0) - (constructSnippetCounts.get(a.id) ?? 0));
  }, [constructSnippetCounts]);

  const modelSnippetCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => {
      const ids = getSnippetModelIds(s);
      ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [snippets]);

  const modelOptionsSortedByCount = useMemo(() => {
    return [...modelOptions].sort((a, b) => (modelSnippetCounts.get(b.id) ?? 0) - (modelSnippetCounts.get(a.id) ?? 0));
  }, [modelOptions, modelSnippetCounts]);

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      if (filterPaperId && s.paper_id !== filterPaperId) return false;
      if (filterJournalNames.length > 0) {
        const paper = paperById.get(s.paper_id);
        const journal = paper?.journal?.trim();
        if (!journal || !filterJournalNames.some((j) => j === journal)) return false;
      }
      if (filterConstructIds.length > 0) {
        const rawSnippetConstructs = getSnippetConstructIds(s);
        const normalisedConstructIds = rawSnippetConstructs
          .map((val) => {
            const match = constructOptions.find(
              (opt) =>
                opt.id === val ||
                opt.name.toLowerCase() === val.toLowerCase() ||
                opt.abbreviation?.toLowerCase() === val.toLowerCase()
            );
            return match ? match.id : val;
          })
          .filter(Boolean);

        if (!normalisedConstructIds.some((id) => filterConstructIds.includes(id))) return false;
      }
      if (filterModelIds.length > 0) {
        const snippetModels = getSnippetModelIds(s);
        if (!snippetModels.some((id) => filterModelIds.includes(id))) return false;
      }
      if (filterTag) {
        const tags = Array.isArray(s.tags) ? s.tags : [];
        if (!tags.some((t) => t.toLowerCase() === filterTag.toLowerCase())) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const inContent = s.content.toLowerCase().includes(q);
        const tags = Array.isArray(s.tags) ? s.tags.join(' ').toLowerCase() : '';
        const constructName =
          constructOptions.find((c) => getSnippetConstructIds(s).includes(c.id))?.name.toLowerCase() ?? '';
        const modelName =
          modelOptions.find((m) => getSnippetModelIds(s).includes(m.id))?.name.toLowerCase() ?? '';
        if (!inContent && !tags.includes(q) && !constructName.includes(q) && !modelName.includes(q))
          return false;
      }
      return true;
    });
  }, [snippets, filterPaperId, filterJournalNames, filterConstructIds, filterModelIds, filterTag, search, paperById]);

  const handleAddSnippet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newContent.trim() || !newPaperId) return;
      if (!supabase || !isSupabaseConfigured()) return;
      setSaving(true);
      setError(null);
      const pageNum = newPageNumber.trim() ? parseInt(newPageNumber, 10) : null;
      const rawTags = newTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const existingByLower = allTags.reduce<Record<string, string>>((acc, t) => {
        acc[t.toLowerCase()] = t;
        return acc;
      }, {});
      const tags: string[] = [];
      for (const t of rawTags) {
        const key = t.toLowerCase();
        const canonical = existingByLower[key] ?? t;
        if (!tags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
          tags.push(canonical);
        }
      }
      const constructIds = newConstructId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const modelIds = newModelId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const { data, error: insertErr } = await supabase
        .from('snippets')
        .insert({
          paper_id: newPaperId,
          construct_id: constructIds[0] ?? null,
          model_id: modelIds[0] ?? null,
          construct_ids: constructIds,
          model_ids: modelIds,
          content: newContent.trim(),
          notes: null,
          tags,
          page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
          snippet_type: newSnippetType.trim() || null,
        })
        .select('*')
        .single();
      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        const inserted = data as Snippet;
        setSnippets((prev) => [inserted, ...prev]);
        if (Array.isArray(inserted.tags)) {
          setAllTags((prev) => {
            const set = new Set(prev);
            for (const t of inserted.tags) {
              if (t && typeof t === 'string') set.add(t);
            }
            return Array.from(set);
          });
        }
        setNewContent('');
        setNewPaperId('');
        setNewConstructId('');
        setNewModelId('');
        setNewPageNumber('');
        setNewTagsInput('');
        setNewSnippetType('');
        setShowAddModal(false);
      }
      setSaving(false);
    },
    [newContent, newPaperId, newConstructId, newModelId, newPageNumber, newTagsInput, newSnippetType, allTags]
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    const confirmed = window.confirm('Delete this snippet?');
    if (!confirmed) return;
    const { error: deleteErr } = await supabase.from('snippets').delete().eq('id', id);
    if (deleteErr) {
      setError(deleteErr.message);
    } else {
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    }
  }, []);

  const startEdit = useCallback((snippet: Snippet) => {
    setEditingId(snippet.id);
    setEditContent(snippet.content);
    setEditConstructId(getSnippetConstructIds(snippet).join(','));
    setEditModelId(getSnippetModelIds(snippet).join(','));
    setEditPageNumber(snippet.page_number != null ? String(snippet.page_number) : '');
    setEditTagsInput(Array.isArray(snippet.tags) ? snippet.tags.join(', ') : '');
    setEditSnippetType((snippet as any).snippet_type ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
    setEditConstructId('');
    setEditModelId('');
    setEditPageNumber('');
    setEditTagsInput('');
    setEditSnippetType('');
  }, []);

  const handleSaveEdit = useCallback(
    async (snippet: Snippet) => {
      if (!supabase || !isSupabaseConfigured()) return;
      if (!editContent.trim()) return;
      const pageNum = editPageNumber.trim() ? parseInt(editPageNumber, 10) : null;

      const constructIds = editConstructId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const modelIds = editModelId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const rawTags = editTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const existingByLower = allTags.reduce<Record<string, string>>((acc, t) => {
        acc[t.toLowerCase()] = t;
        return acc;
      }, {});
      const tags: string[] = [];
      for (const t of rawTags) {
        const key = t.toLowerCase();
        const canonical = existingByLower[key] ?? t;
        if (!tags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
          tags.push(canonical);
        }
      }
      const { data, error: updateErr } = await supabase
        .from('snippets')
        .update({
          content: editContent.trim(),
          construct_id: constructIds[0] ?? null,
          model_id: modelIds[0] ?? null,
          construct_ids: constructIds,
          model_ids: modelIds,
          page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
          snippet_type: editSnippetType.trim() || null,
          tags,
        })
        .eq('id', snippet.id)
        .select('*')
        .single();
      if (updateErr) {
        setError(updateErr.message);
      } else if (data) {
        const updated = data as Snippet;
        setSnippets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (Array.isArray(updated.tags)) {
          setAllTags((prev) => {
            const set = new Set(prev);
            for (const t of updated.tags) {
              if (t && typeof t === 'string') set.add(t);
            }
            return Array.from(set);
          });
        }
        cancelEdit();
      }
    },
    [editContent, editConstructId, editModelId, editPageNumber, editTagsInput, editSnippetType, allTags, cancelEdit]
  );

  if (loading) {
    return (
      <div className="snippets-page">
        <p className="snippets-loading">Loading snippets…</p>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="snippets-page">
        <p className="snippets-error">
          Supabase is not configured. Set <code>PUBLIC_SUPABASE_URL</code> and{' '}
          <code>PUBLIC_SUPABASE_ANON_KEY</code> in your environment or <code>.env</code> file.
        </p>
      </div>
    );
  }

  return (
    <div className="snippets-page">
      <header className="snippets-header">
        <h1>Snippets</h1>
        <p className="snippets-intro">
          Conceptual snippets extracted from papers. Filter by paper, construct, model, or tags.
        </p>
        <button
          type="button"
          className="snippets-open-add-btn"
          onClick={() => setShowAddModal(true)}
        >
          Add snippet
        </button>
      </header>

      {error && <p className="snippets-error">{error}</p>}

      <div className="snippets-layout">
        <section className="snippets-filters">
          <div className="snippets-filter-row">
            <label className="snippets-search-label">
              Search
              <input
                type="search"
                className="snippets-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search in snippet text, tags, constructs, models…"
              />
            </label>
            <button
              type="button"
              className="snippets-clear-btn"
              onClick={() => {
                setFilterPaperId('');
                setFilterJournalNames([]);
                setFilterConstructIds([]);
                setFilterModelIds([]);
                setFilterTag('');
                setSearch('');
              }}
              title="Clear all filters"
            >
              <span className="snippets-clear-icon" aria-hidden>×</span>
              Clear filters
            </button>
          </div>
          <div className="snippets-filter-row">
            <label>
              Paper
              <select
                className="snippets-input"
                value={filterPaperId}
                onChange={(e) => setFilterPaperId(e.target.value)}
              >
                <option value="">All</option>
                {papersSortedByCount.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.url}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="snippets-filter-row">
            <label>
              Model(s)
              <select
                multiple
                size={modelOptions.length}
                className="snippets-input snippets-model-select"
                value={filterModelIds}
                onChange={(e) =>
                  setFilterModelIds(
                    Array.from(e.target.selectedOptions).map((opt) => opt.value)
                  )
                }
              >
                {modelOptionsSortedByCount.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="snippets-filter-row">
            <label>
              Construct(s)
              <select
                multiple
                size={Math.max(4, Math.min(15, constructOptions.length))}
                className="snippets-input snippets-construct-select"
                value={filterConstructIds}
                onChange={(e) =>
                  setFilterConstructIds(
                    Array.from(e.target.selectedOptions).map((opt) => opt.value)
                  )
                }
              >
                {constructOptionsSortedByCount.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="snippets-filter-row">
            <label>
              Journal(s)
              <select
                multiple
                size={Math.max(4, Math.min(8, allJournals.length || 1))}
                className="snippets-input snippets-journal-select"
                value={filterJournalNames}
                onChange={(e) =>
                  setFilterJournalNames(
                    Array.from(e.target.selectedOptions).map((opt) => opt.value)
                  )
                }
              >
                {allJournals.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="snippets-filter-row">
            <label>
              Tag
              <select
                className="snippets-input"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

      {showAddModal && (
        <div className="snippets-modal-overlay" role="dialog" aria-modal="true">
          <div className="snippets-modal">
            <header className="snippets-modal-header">
              <h2 className="snippets-section-title">Add snippet</h2>
              <button
                type="button"
                className="snippets-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form className="snippets-form" onSubmit={handleAddSnippet}>
              <label className="snippets-label">
                Paper
                <select
                  className="snippets-input"
                  value={newPaperId}
                  onChange={(e) => setNewPaperId(e.target.value)}
                  required
                >
                  <option value="">Select a paper…</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.url}
                    </option>
                  ))}
                </select>
              </label>
              <label className="snippets-label">
                Snippet text
                <textarea
                  className="snippets-textarea"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  placeholder="Paste or type the key idea, quote, or conceptual snippet…"
                  required
                />
              </label>
              <div className="snippets-form-row">
                <label className="snippets-label-inline">
                  Construct(s)
                  <select
                    multiple
                    className="snippets-input-inline"
                    value={newConstructId ? newConstructId.split(',') : []}
                    onChange={(e) =>
                      setNewConstructId(
                        Array.from(e.target.selectedOptions)
                          .map((opt) => opt.value)
                          .join(',')
                      )
                    }
                  >
                    {constructOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="snippets-label-inline">
                  Model(s)
                  <select
                    multiple
                    className="snippets-input-inline"
                    value={newModelId ? newModelId.split(',') : []}
                    onChange={(e) =>
                      setNewModelId(
                        Array.from(e.target.selectedOptions)
                          .map((opt) => opt.value)
                          .join(',')
                      )
                    }
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="snippets-label-inline">
                  Page (optional)
                  <input
                    type="number"
                    min={1}
                    className="snippets-input-inline snippets-input-page"
                    value={newPageNumber}
                    onChange={(e) => setNewPageNumber(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </label>
                <label className="snippets-label-inline">
                  Tags (optional)
                  <input
                    type="text"
                    list="snippets-tags-list"
                    className="snippets-input-inline"
                    value={newTagsInput}
                    onChange={(e) => setNewTagsInput(e.target.value)}
                    placeholder="e.g. method, theory"
                  />
                </label>
                <label className="snippets-label-inline">
                  Snippet type
                  <select
                    className="snippets-input-inline"
                    value={newSnippetType}
                    onChange={(e) => setNewSnippetType(e.target.value)}
                  >
                    {SNIPPET_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <datalist id="snippets-tags-list">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="snippets-modal-actions">
                <button type="submit" className="snippets-add-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Add snippet'}
                </button>
                <button
                  type="button"
                  className="snippets-edit-cancel-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        <section className="snippets-list-section">
        <h2 className="snippets-section-title">
          Snippets ({filteredSnippets.length})
        </h2>
        {filteredSnippets.length === 0 && (
          <p className="snippets-empty">No snippets match the current filters.</p>
        )}
        <div className="snippets-list">
          {filteredSnippets.map((s) => {
            const paper = paperById.get(s.paper_id);
            return (
              <article key={s.id} className="snippets-card">
                <header className="snippets-card-header">
                  <div className="snippets-card-title-row">
                    <h3 className="snippets-card-title">
                      {s.content.length > 140 ? `${s.content.slice(0, 140)}…` : s.content}
                    </h3>
                  </div>
                  {(s as any).snippet_type && (
                    <span className="snippets-card-type">{(s as any).snippet_type}</span>
                  )}
                  <div className="snippets-card-links">
                    {(() => {
                      const constructIds = getSnippetConstructIds(s);
                      return constructIds.map((id) => {
                        const c = constructOptions.find((opt) => opt.id === id);
                        return (
                          <a
                            key={id}
                            href={`${base}constructs/${id}/`}
                            className="snippets-chip snippets-chip-construct"
                          >
                            {c?.name || id}
                          </a>
                        );
                      });
                    })()}
                    {(() => {
                      const modelIds = getSnippetModelIds(s);
                      return modelIds.map((id) => {
                        const m = modelOptions.find((opt) => opt.id === id);
                        return (
                          <a
                            key={id}
                            href={`${base}models/${id}/`}
                            className="snippets-chip snippets-chip-model"
                          >
                            {m?.name || id}
                          </a>
                        );
                      });
                    })()}
                  </div>
                </header>
                {editingId === s.id ? (
                  <div className="snippets-edit-form">
                    <label className="snippets-label">
                      Snippet text
                      <textarea
                        className="snippets-textarea"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="snippets-form-row">
                    <label className="snippets-label-inline">
                      Construct(s)
                      <select
                        multiple
                        className="snippets-input-inline"
                        value={editConstructId ? editConstructId.split(',') : []}
                        onChange={(e) =>
                          setEditConstructId(
                            Array.from(e.target.selectedOptions)
                              .map((opt) => opt.value)
                              .join(',')
                          )
                        }
                      >
                        {constructOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="snippets-label-inline">
                      Model(s)
                      <select
                        multiple
                        className="snippets-input-inline"
                        value={editModelId ? editModelId.split(',') : []}
                        onChange={(e) =>
                          setEditModelId(
                            Array.from(e.target.selectedOptions)
                              .map((opt) => opt.value)
                              .join(',')
                          )
                        }
                      >
                        {modelOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                      <label className="snippets-label-inline">
                        Page
                        <input
                          type="number"
                          min={1}
                          className="snippets-input-inline snippets-input-page"
                          value={editPageNumber}
                          onChange={(e) => setEditPageNumber(e.target.value)}
                          placeholder="e.g. 12"
                        />
                      </label>
                      <label className="snippets-label-inline">
                        Tags
                        <input
                          type="text"
                          list="snippets-tags-list"
                          className="snippets-input-inline"
                          value={editTagsInput}
                          onChange={(e) => setEditTagsInput(e.target.value)}
                          placeholder="e.g. method, theory"
                        />
                      </label>
                      <label className="snippets-label-inline">
                        Snippet type
                        <select
                          className="snippets-input-inline"
                          value={editSnippetType}
                          onChange={(e) => setEditSnippetType(e.target.value)}
                        >
                          {SNIPPET_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value || 'none'} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="snippets-card-footer">
                      <span className="snippets-card-date">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <div className="snippets-card-actions">
                        <button
                          type="button"
                          className="snippets-edit-save-btn"
                          onClick={() => handleSaveEdit(s)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="snippets-edit-cancel-btn"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="snippets-card-content">
                      {paper ? (
                        <a
                          href={`${base}papers/detail/?id=${paper.id}`}
                          className="snippets-card-paper"
                        >
                          {paper.title || paper.url}
                        </a>
                      ) : (
                        <span className="snippets-card-paper">Unknown paper</span>
                      )}
                      {s.page_number != null && editingId !== s.id && (
                        <span className="snippets-card-page-inline"> · Page {s.page_number}</span>
                      )}
                      {paper?.journal?.trim() && editingId !== s.id && (
                        <span className="snippets-card-journal"> · {paper.journal.trim()}</span>
                      )}
                    </p>
                    {Array.isArray(s.tags) && s.tags.length > 0 && (
                      <div className="snippets-card-tags">
                        {s.tags.map((tag) => (
                          <span key={tag} className="snippets-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <footer className="snippets-card-footer">
                      <span className="snippets-card-date">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <div className="snippets-card-actions">
                        <button
                          type="button"
                          className="snippets-edit-btn"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="snippets-delete-btn"
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </footer>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
      </div>
    </div>
  );
}

