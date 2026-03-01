import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ConstructNote {
  id: string;
  construct_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ConstructNotesProps {
  constructId: string;
  /** Optional static note from JSON to show when Supabase is not configured */
  staticNote?: string | null;
}

function mapRow(row: { id: string; construct_id: string; content: string; created_at: string; updated_at: string }): ConstructNote {
  return {
    id: row.id,
    construct_id: row.construct_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function ConstructNotes({ constructId, staticNote }: ConstructNotesProps) {
  const [notes, setNotes] = useState<ConstructNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!supabase || !constructId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('construct_notes')
      .select('*')
      .eq('construct_id', constructId)
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setNotes([]);
    } else {
      setNotes((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, [constructId]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !constructId) {
      setLoading(false);
      return;
    }
    fetchNotes();
  }, [constructId, fetchNotes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !constructId || !newContent.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('construct_notes')
      .insert({ construct_id: constructId, content: newContent.trim() })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setNotes((prev) => [mapRow(data), ...prev]);
      setNewContent('');
    }
  };

  const startEdit = (note: ConstructNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('construct_notes')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', editingId)
      .select('*')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setNotes((prev) => prev.map((n) => (n.id === editingId ? mapRow(data) : n)));
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this note?')) return;
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('construct_notes').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso.slice(0, 16);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <section className="construct-notes-section">
        <h2 className="construct-notes-title">Notes</h2>
        <p className="construct-notes-setup">
          Add your Supabase credentials to use interactive notes (add, edit, delete).
        </p>
        {staticNote && <p className="construct-notes-static">{staticNote}</p>}
      </section>
    );
  }

  return (
    <section className="construct-notes-section">
      <h2 className="construct-notes-title">Notes</h2>
      {error && <p className="construct-notes-error">{error}</p>}

      <form className="construct-notes-add-form" onSubmit={handleAdd}>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="construct-notes-textarea"
        />
        <button type="submit" className="construct-notes-add-btn" disabled={saving || !newContent.trim()}>
          {saving ? 'Adding…' : 'Add note'}
        </button>
      </form>

      {loading ? (
        <p className="construct-notes-loading">Loading notes…</p>
      ) : (
        <ul className="construct-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="construct-notes-item">
              {editingId === note.id ? (
                <form className="construct-notes-edit-form" onSubmit={handleSaveEdit}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="construct-notes-textarea"
                    autoFocus
                  />
                  <div className="construct-notes-edit-actions">
                    <button type="submit" className="construct-notes-btn construct-notes-btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="construct-notes-btn construct-notes-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="construct-notes-item-header">
                    <time dateTime={note.created_at} className="construct-notes-item-date">
                      {formatDate(note.updated_at !== note.created_at ? note.updated_at : note.created_at)}
                    </time>
                    <div className="construct-notes-item-actions">
                      <button type="button" className="construct-notes-item-action" onClick={() => startEdit(note)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="construct-notes-item-action construct-notes-item-delete"
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <p className="construct-notes-item-content">{note.content}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && notes.length === 0 && (
        <p className="construct-notes-empty">No notes yet. Add one above.</p>
      )}
    </section>
  );
}
