import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FormatDiaryText } from '../lib/formatDiaryText';

interface Contribution {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}): Contribution {
  return {
    id: row.id,
    content: row.content,
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

export default function ContributionsPage() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('research_contributions')
      .select('id, content, created_at, updated_at')
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
    if (!supabase) return;
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('research_contributions')
      .insert({ content })
      .select('id, content, created_at, updated_at')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setItems((prev) => [mapRow(data), ...prev]);
      setDraft('');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!supabase) return;
    const content = editDraft.trim();
    if (!content) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('research_contributions')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, content, created_at, updated_at')
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
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="contributions-setup">
        <h3>Contributions require Supabase</h3>
        <p>
          Add your Supabase credentials and run migration{' '}
          <code>036_research_contributions.sql</code> to save contributions.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="contributions-loading">Loading…</p>;
  }

  return (
    <div className="contributions-page">
      {error && <p className="contributions-error">{error}</p>}

      <form className="contributions-add-form" onSubmit={handleAdd}>
        <label htmlFor="contribution-draft">Add a contribution</label>
        <textarea
          id="contribution-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Describe a contribution to theory, practice, or methodology…"
          className="contributions-textarea"
        />
        <p className="contributions-format-hint">
          Line breaks are preserved. Use <code>**text**</code> for <strong>bold</strong>.
        </p>
        <button type="submit" className="contributions-submit" disabled={saving || !draft.trim()}>
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
                        disabled={saving || !editDraft.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="contributions-btn contributions-btn-secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="contribution-content">
                      <FormatDiaryText text={item.content} />
                    </p>
                    <div className="contribution-meta">
                      <time dateTime={item.updated_at}>{formatDate(item.updated_at)}</time>
                      <div className="contribution-actions">
                        <button
                          type="button"
                          className="contributions-btn contributions-btn-secondary"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditDraft(item.content);
                          }}
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
