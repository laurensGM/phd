import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ModelNote {
  id: string;
  model_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ModelNotesProps {
  modelId: string;
  /** Optional static note from JSON to show when Supabase is not configured */
  staticNote?: string | null;
}

function mapRow(row: { id: string; model_id: string; content: string; created_at: string; updated_at: string }): ModelNote {
  return {
    id: row.id,
    model_id: row.model_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function ModelNotes({ modelId, staticNote }: ModelNotesProps) {
  const [notes, setNotes] = useState<ModelNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!supabase || !modelId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('model_notes')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setNotes([]);
    } else {
      setNotes((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, [modelId]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !modelId) {
      setLoading(false);
      return;
    }
    fetchNotes();
  }, [modelId, fetchNotes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !modelId || !newContent.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('model_notes')
      .insert({ model_id: modelId, content: newContent.trim() })
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

  const startEdit = (note: ModelNote) => {
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
      .from('model_notes')
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
    const { error: deleteError } = await supabase.from('model_notes').delete().eq('id', id);
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
      <section className="model-notes-section">
        <h3 className="model-notes-title">Notes</h3>
        <p className="model-notes-setup">
          Add your Supabase credentials to use interactive notes (add, edit, delete).
        </p>
        {staticNote && <div className="model-notes-static">{staticNote}</div>}
      </section>
    );
  }

  return (
    <section className="model-notes-section">
      <h3 className="model-notes-title">Notes</h3>
      {error && <p className="model-notes-error">{error}</p>}

      <form className="model-notes-add-form" onSubmit={handleAdd}>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="model-notes-textarea"
        />
        <button type="submit" className="model-notes-add-btn" disabled={saving || !newContent.trim()}>
          {saving ? 'Adding…' : 'Add note'}
        </button>
      </form>

      {loading ? (
        <p className="model-notes-loading">Loading notes…</p>
      ) : (
        <ul className="model-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="model-notes-item">
              {editingId === note.id ? (
                <form className="model-notes-edit-form" onSubmit={handleSaveEdit}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="model-notes-textarea"
                    autoFocus
                  />
                  <div className="model-notes-edit-actions">
                    <button type="submit" className="model-notes-btn model-notes-btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="model-notes-btn model-notes-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="model-notes-item-header">
                    <time dateTime={note.created_at} className="model-notes-item-date">
                      {formatDate(note.updated_at !== note.created_at ? note.updated_at : note.created_at)}
                    </time>
                    <div className="model-notes-item-actions">
                      <button type="button" className="model-notes-item-action" onClick={() => startEdit(note)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="model-notes-item-action model-notes-item-delete"
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <p className="model-notes-item-content">{note.content}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && notes.length === 0 && (
        <p className="model-notes-empty">No notes yet. Add one above.</p>
      )}
    </section>
  );
}
