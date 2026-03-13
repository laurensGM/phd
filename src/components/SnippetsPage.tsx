import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';

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

interface PaperSummary {
  id: string;
  title: string | null;
  url: string;
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

export default function SnippetsPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterPaperId, setFilterPaperId] = useState('');
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

  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editConstructId, setEditConstructId] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editPageNumber, setEditPageNumber] = useState<string>('');
  const [editTagsInput, setEditTagsInput] = useState('');
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
          supabase!.from('saved_papers').select('id,title,url'),
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

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      if (filterPaperId && s.paper_id !== filterPaperId) return false;
      if (filterConstructIds.length > 0) {
        const c = (s as any).construct_ids ?? (s as any).construct_id;
        const rawSnippetConstructs: string[] = Array.isArray(c)
          ? (c as string[])
          : typeof c === 'string'
          ? c
              .split(',')
              .map((id: string) => id.trim())
              .filter(Boolean)
          : [];

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

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/02fd28e7-3222-47e0-bfbf-09aec767430a', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '1c5708',
          },
          body: JSON.stringify({
            sessionId: '1c5708',
            runId: 'pre-fix',
            hypothesisId: 'H-construct-mismatch',
            location: 'SnippetsPage.tsx:constructFilter',
            message: 'Evaluating construct filter for snippet',
            data: {
              snippetId: s.id,
              filterConstructIds,
              rawConstruct: c,
              rawSnippetConstructs,
              normalisedConstructIds,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        if (!normalisedConstructIds.some((id) => filterConstructIds.includes(id))) return false;
      }
      if (filterModelIds.length > 0) {
        const m = (s as any).model_ids ?? (s as any).model_id;
        const snippetModels = Array.isArray(m) ? (m as string[]) : m ? [m as string] : [];
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
          constructOptions.find((c) =>
            ((s as any).construct_ids ?? [(s as any).construct_id]).includes(c.id)
          )?.name.toLowerCase() ?? '';
        const modelName =
          modelOptions.find((m) =>
            ((s as any).model_ids ?? [(s as any).model_id]).includes(m.id)
          )?.name.toLowerCase() ?? '';
        if (!inContent && !tags.includes(q) && !constructName.includes(q) && !modelName.includes(q))
          return false;
      }
      return true;
    });
  }, [snippets, filterPaperId, filterConstructIds, filterModelIds, filterTag, search]);

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
        setShowAddModal(false);
      }
      setSaving(false);
    },
    [newContent, newPaperId, newConstructId, newModelId, newPageNumber, newTagsInput, allTags]
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

    const rawConstruct = (snippet as any).construct_ids ?? (snippet as any).construct_id;
    const constructIds =
      Array.isArray(rawConstruct)
        ? (rawConstruct as string[])
        : typeof rawConstruct === 'string' && rawConstruct.length
        ? rawConstruct
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : [];
    setEditConstructId(constructIds.join(','));

    const rawModel = (snippet as any).model_ids ?? (snippet as any).model_id;
    const modelIds =
      Array.isArray(rawModel)
        ? (rawModel as string[])
        : typeof rawModel === 'string' && rawModel.length
        ? rawModel
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean)
        : [];
    setEditModelId(modelIds.join(','));

    setEditPageNumber(snippet.page_number != null ? String(snippet.page_number) : '');
    setEditTagsInput(Array.isArray(snippet.tags) ? snippet.tags.join(', ') : '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
    setEditConstructId('');
    setEditModelId('');
    setEditPageNumber('');
    setEditTagsInput('');
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
    [editContent, editConstructId, editModelId, editPageNumber, editTagsInput, allTags, cancelEdit]
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
            <label>
              Paper
              <select
                className="snippets-input"
                value={filterPaperId}
                onChange={(e) => setFilterPaperId(e.target.value)}
              >
                <option value="">All</option>
                {papers.map((p) => (
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
                {modelOptions.map((m) => (
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
                size={Math.max(4, Math.min(8, constructOptions.length))}
                className="snippets-input snippets-construct-select"
                value={filterConstructIds}
                onChange={(e) =>
                  setFilterConstructIds(
                    Array.from(e.target.selectedOptions).map((opt) => opt.value)
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
                setFilterConstructIds([]);
                setFilterModelIds([]);
                setFilterTag('');
                setSearch('');
              }}
            >
              Clear filters
            </button>
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
                  <div className="snippets-card-links">
                    {(() => {
                      const rawConstruct = (s as any).construct_ids ?? (s as any).construct_id;
                      const constructIds: string[] = Array.isArray(rawConstruct)
                        ? rawConstruct
                        : rawConstruct
                        ? String(rawConstruct)
                            .split(',')
                            .map((id: string) => id.trim())
                            .filter(Boolean)
                        : [];
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
                      const rawModel = (s as any).model_ids ?? (s as any).model_id;
                      const modelIds: string[] = Array.isArray(rawModel)
                        ? rawModel
                        : rawModel
                        ? String(rawModel)
                            .split(',')
                            .map((id: string) => id.trim())
                            .filter(Boolean)
                        : [];
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

