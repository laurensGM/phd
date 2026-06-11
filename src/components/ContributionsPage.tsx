import React, { useState, useEffect, useCallback } from 'react';
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

export default function ContributionsPage() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [draft, setDraft] = useState('');
  const [draftType, setDraftType] = useState<ContributionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editType, setEditType] = useState<ContributionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('research_contributions')
      .select('id, content, contribution_type, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
    } else {
      setItems((data ?? []).map(mapRow));
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

  return (
    <div className="contributions-page">
      {error && <p className="contributions-error">{error}</p>}

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
        <button type="submit" className="contributions-submit" disabled={saving || !canAdd}>
          {saving ? 'Saving…' : 'Add contribution'}
        </button>
      </form>

      <section className="contributions-list-section">
        <h2 className="contributions-list-title">
          Your contributions
          {items.length > 0 && (
            <span className="contributions-count">
              {' '}
              ({items.length})
            </span>
          )}
        </h2>

        {items.length === 0 ? (
          <p className="contributions-empty">No contributions yet. Add your first statement above.</p>
        ) : (
          <ul className="contributions-list">
            {items.map((item) => (
              <li key={item.id} className="contribution-item">
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
