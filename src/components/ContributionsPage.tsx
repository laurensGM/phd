import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FormatDiaryText } from '../lib/formatDiaryText';
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  type ContributionType,
  isContributionType,
} from '../data/contribution-types';

interface Contribution {
  id: string;
  content: string;
  contribution_type: ContributionType | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: {
  id: string;
  content: string;
  contribution_type?: string | null;
  created_at: string;
  updated_at: string;
}): Contribution {
  return {
    id: row.id,
    content: row.content,
    contribution_type: isContributionType(row.contribution_type) ? row.contribution_type : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

interface TypePickerProps {
  idPrefix: string;
  value: ContributionType | null;
  onChange: (type: ContributionType) => void;
}

function TypePicker({ idPrefix, value, onChange }: TypePickerProps) {
  return (
    <fieldset className="contribution-type-field">
      <legend className="contribution-type-legend">Contribution type</legend>
      <div className="contribution-type-toggles" role="radiogroup" aria-label="Contribution type">
        {CONTRIBUTION_TYPES.map((type) => (
          <label key={type} className={`contribution-type-chip${value === type ? ' contribution-type-chip--active' : ''}`}>
            <input
              type="radio"
              name={`${idPrefix}-contribution-type`}
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
              className="contribution-type-radio"
            />
            {CONTRIBUTION_TYPE_LABELS[type]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type TypeFilter = 'all' | ContributionType;

function TypeFilterBar({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (filter: TypeFilter) => void;
  counts: Record<TypeFilter, number>;
}) {
  const options: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    ...CONTRIBUTION_TYPES.map((type) => ({ id: type, label: CONTRIBUTION_TYPE_LABELS[type] })),
  ];

  return (
    <div className="contributions-filter-bar" role="group" aria-label="Filter by contribution type">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`contributions-filter-chip${value === option.id ? ' contributions-filter-chip--active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          <span className="contributions-filter-count">{counts[option.id]}</span>
        </button>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: ContributionType | null }) {
  if (!type) {
    return <span className="contribution-type-badge contribution-type-badge--unset">No type set</span>;
  }
  return (
    <span className={`contribution-type-badge contribution-type-badge--${type}`}>
      {CONTRIBUTION_TYPE_LABELS[type]}
    </span>
  );
}

interface LinkedSnippet {
  id: string;
  content: string;
  paper_id: string;
  contribution_id: string | null;
}

interface PaperTitle {
  id: string;
  title: string | null;
  url: string;
}

function snippetPreview(content: string, max = 120): string {
  const text = content.trim().replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function ContributionsPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [items, setItems] = useState<Contribution[]>([]);
  const [draft, setDraft] = useState('');
  const [draftType, setDraftType] = useState<ContributionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editType, setEditType] = useState<ContributionType | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [linkedSnippets, setLinkedSnippets] = useState<LinkedSnippet[]>([]);
  const [papers, setPapers] = useState<PaperTitle[]>([]);
  const [expandedSnippetContributions, setExpandedSnippetContributions] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [contribRes, snippetsRes, papersRes] = await Promise.all([
      supabase
        .from('research_contributions')
        .select('id, content, contribution_type, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('snippets')
        .select('id, content, paper_id, contribution_id')
        .not('contribution_id', 'is', null),
      supabase.from('saved_papers').select('id, title, url'),
    ]);

    if (contribRes.error) {
      setError(contribRes.error.message);
      setItems([]);
    } else {
      setItems((contribRes.data ?? []).map(mapRow));
    }

    if (snippetsRes.error) {
      setLinkedSnippets([]);
    } else {
      setLinkedSnippets((snippetsRes.data ?? []) as LinkedSnippet[]);
    }

    if (papersRes.error) {
      setPapers([]);
    } else {
      setPapers(
        (papersRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string | null) ?? null,
          url: row.url as string,
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !draftType) return;
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('research_contributions')
      .insert({ content, contribution_type: draftType })
      .select('id, content, contribution_type, created_at, updated_at')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setItems((prev) => [mapRow(data), ...prev]);
      setDraft('');
      setDraftType(null);
      setShowAddForm(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!supabase || !editType) return;
    const content = editDraft.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('research_contributions')
      .update({
        content,
        contribution_type: editType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, content, contribution_type, created_at, updated_at')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setItems((prev) => prev.map((item) => (item.id === id ? mapRow(data) : item)));
      setEditingId(null);
      setEditDraft('');
      setEditType(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('research_contributions').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setLinkedSnippets((prev) => prev.filter((snippet) => snippet.contribution_id !== id));
    setExpandedSnippetContributions((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (editingId === id) {
      setEditingId(null);
      setEditDraft('');
      setEditType(null);
    }
  };

  const startEdit = (item: Contribution) => {
    setEditingId(item.id);
    setEditDraft(item.content);
    setEditType(item.contribution_type);
  };

  const filterCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      all: items.length,
      theoretical: 0,
      methodological: 0,
      practical: 0,
    };
    for (const item of items) {
      if (item.contribution_type) counts[item.contribution_type] += 1;
    }
    return counts;
  }, [items]);

  const paperById = useMemo(() => {
    const map = new Map<string, PaperTitle>();
    for (const paper of papers) map.set(paper.id, paper);
    return map;
  }, [papers]);

  const snippetsByContributionId = useMemo(() => {
    const map = new Map<string, LinkedSnippet[]>();
    for (const snippet of linkedSnippets) {
      if (!snippet.contribution_id) continue;
      const list = map.get(snippet.contribution_id) ?? [];
      list.push(snippet);
      map.set(snippet.contribution_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.content.localeCompare(b.content, undefined, { sensitivity: 'base' }));
    }
    return map;
  }, [linkedSnippets]);

  const filteredItems = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((item) => item.contribution_type === typeFilter);
  }, [items, typeFilter]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="contributions-setup">
        <h3>Contributions require Supabase</h3>
        <p>
          Add your Supabase credentials and run migrations <code>036_research_contributions.sql</code> and{' '}
          <code>039_research_contributions_type.sql</code> to save contributions.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="contributions-loading">Loading…</p>;
  }

  const canAdd = draft.trim().length > 0 && draftType !== null;

  const closeAddForm = () => {
    setShowAddForm(false);
    setDraft('');
    setDraftType(null);
  };

  const toggleLinkedSnippets = (contributionId: string) => {
    setExpandedSnippetContributions((prev) => {
      const next = new Set(prev);
      if (next.has(contributionId)) next.delete(contributionId);
      else next.add(contributionId);
      return next;
    });
  };

  return (
    <div className="contributions-page">
      {error && <p className="contributions-error">{error}</p>}

      <div className="contributions-add-section">
        {!showAddForm ? (
          <button
            type="button"
            className="contributions-add-toggle"
            onClick={() => setShowAddForm(true)}
          >
            Add contribution
          </button>
        ) : (
          <form className="contributions-add-form" onSubmit={handleAdd}>
            <label htmlFor="contribution-draft">Add a contribution</label>
            <TypePicker idPrefix="add" value={draftType} onChange={setDraftType} />
            <textarea
              id="contribution-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Describe your contribution…"
              className="contributions-textarea"
            />
            <p className="contributions-format-hint">
              Line breaks are preserved. Use <code>**text**</code> for <strong>bold</strong>.
            </p>
            <div className="contribution-actions">
              <button type="submit" className="contributions-submit" disabled={saving || !canAdd}>
                {saving ? 'Saving…' : 'Add contribution'}
              </button>
              <button
                type="button"
                className="contributions-btn contributions-btn-secondary"
                onClick={closeAddForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <section className="contributions-list-section">
        <h2 className="contributions-list-title">
          Your contributions
          {items.length > 0 && (
            <span className="contributions-count">
              {' '}
              ({typeFilter === 'all' ? items.length : `${filteredItems.length} of ${items.length}`})
            </span>
          )}
        </h2>

        {items.length > 0 && (
          <TypeFilterBar value={typeFilter} onChange={setTypeFilter} counts={filterCounts} />
        )}

        {items.length === 0 ? (
          <p className="contributions-empty">No contributions yet. Click &ldquo;Add contribution&rdquo; to add your first statement.</p>
        ) : filteredItems.length === 0 ? (
          <p className="contributions-empty">
            No {CONTRIBUTION_TYPE_LABELS[typeFilter as ContributionType].toLowerCase()} contributions yet.
          </p>
        ) : (
          <ul className="contributions-list">
            {filteredItems.map((item) => {
              const linked = snippetsByContributionId.get(item.id) ?? [];
              const snippetsExpanded = expandedSnippetContributions.has(item.id);
              return (
              <li key={item.id} id={`contribution-${item.id}`} className="contribution-item">
                {editingId === item.id ? (
                  <div className="contribution-edit">
                    <TypePicker idPrefix={`edit-${item.id}`} value={editType} onChange={setEditType} />
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={4}
                      className="contributions-textarea"
                    />
                    <div className="contribution-actions">
                      <button
                        type="button"
                        className="contributions-btn contributions-btn-primary"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={saving || !editDraft.trim() || !editType}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="contributions-btn contributions-btn-secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft('');
                          setEditType(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <TypeBadge type={item.contribution_type} />
                    <p className="contribution-content">
                      <FormatDiaryText text={item.content} />
                    </p>
                    {linked.length > 0 && (
                      <div className="contribution-linked-snippets">
                        <button
                          type="button"
                          className="contributions-btn contributions-btn-secondary contributions-show-snippets-btn"
                          onClick={() => toggleLinkedSnippets(item.id)}
                        >
                          {snippetsExpanded
                            ? `Hide ${linked.length} snippet${linked.length === 1 ? '' : 's'}`
                            : `Show ${linked.length} snippet${linked.length === 1 ? '' : 's'}`}
                        </button>
                        {snippetsExpanded && (
                          <ul className="contribution-linked-snippets-list">
                            {linked.map((snippet) => {
                              const paper = paperById.get(snippet.paper_id);
                              return (
                                <li key={snippet.id} className="contribution-linked-snippet-item">
                                  <a
                                    href={`${base}snippets/#snippet-${snippet.id}`}
                                    className="contribution-linked-snippet-link"
                                  >
                                    {snippetPreview(snippet.content)}
                                  </a>
                                  {paper && (
                                    <span className="contribution-linked-snippet-paper">
                                      {paper.title || paper.url}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                    <div className="contribution-meta">
                      <time dateTime={item.updated_at}>{formatDate(item.updated_at)}</time>
                      <div className="contribution-actions">
                        <button
                          type="button"
                          className="contributions-btn contributions-btn-secondary"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="contributions-btn contributions-btn-delete"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
