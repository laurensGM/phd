import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';
import { FormatDiaryText, handleRichTextareaKeyDown } from '../lib/formatDiaryText';

interface MeetingNote {
  id: string;
  date: string;
  title: string;
  content: string | null;
  participants: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: {
  id: string;
  date: string;
  title: string;
  content: string | null;
  participants: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}): MeetingNote {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    content: row.content ?? null,
    participants: row.participants ?? null,
    location: row.location ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function MeetingNotesPage() {
  const { loading: permLoading, canViewMeetingNotes, canEditMeetingNotes } = usePermissions();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    content: '',
    participants: '',
    location: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    title: '',
    content: '',
    participants: '',
    location: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('meeting_notes')
      .select('*')
      .order('date', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setNotes([]);
    } else {
      setNotes((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchNotes();
  }, [fetchNotes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !n.title.toLowerCase().includes(q) &&
          !n.content?.toLowerCase().includes(q) &&
          !n.participants?.toLowerCase().includes(q) &&
          !n.location?.toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFrom && n.date < dateFrom) return false;
      if (dateTo && n.date > dateTo) return false;
      return true;
    });
  }, [notes, search, dateFrom, dateTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMeetingNotes || !supabase) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('meeting_notes')
      .insert({
        date: formData.date,
        title: formData.title.trim(),
        content: formData.content.trim() || null,
        participants: formData.participants.trim() || null,
        location: formData.location.trim() || null,
      })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setNotes((prev) => [mapRow(data), ...prev]);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        title: '',
        content: '',
        participants: '',
        location: '',
      });
      setShowForm(false);
      setExpandedId(data.id);
    }
  };

  const startEdit = (note: MeetingNote) => {
    setExpandedId(note.id);
    setEditingId(note.id);
    setEditForm({
      date: note.date,
      title: note.title,
      content: note.content ?? '',
      participants: note.participants ?? '',
      location: note.location ?? '',
    });
    setError(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMeetingNotes || !supabase || !editingId) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('meeting_notes')
      .update({
        date: editForm.date,
        title: editForm.title.trim(),
        content: editForm.content.trim() || null,
        participants: editForm.participants.trim() || null,
        location: editForm.location.trim() || null,
        updated_at: new Date().toISOString(),
      })
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
    if (!canEditMeetingNotes) return;
    if (!window.confirm('Delete this meeting note?')) return;
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('meeting_notes').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="meeting-notes-page">
      {!isSupabaseConfigured() && (
        <div className="meeting-notes-setup">
          <h3>Meeting notes require Supabase</h3>
          <p>Add your Supabase credentials to add, edit, and delete meeting notes. See the README for setup.</p>
          <p className="meeting-notes-setup-hint">
            Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_ANON_KEY</code> in your environment or <code>.env</code> file.
          </p>
        </div>
      )}
      {isSupabaseConfigured() && (loading || permLoading) && (
        <div className="meeting-notes-loading">Loading meeting notes…</div>
      )}
      {isSupabaseConfigured() && !loading && !permLoading && !canViewMeetingNotes && (
        <AccessDenied
          message="Your role cannot view meeting notes."
          permission="nav.manager.meeting_notes"
        />
      )}
      {isSupabaseConfigured() && !loading && !permLoading && canViewMeetingNotes && (
    <>
      {error && <p className="meeting-notes-error">{error}</p>}

      {canEditMeetingNotes && (
      <section className="meeting-notes-add-section">
        <button
          className="meeting-notes-add-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '− Hide form' : '+ New meeting note'}
        </button>

        {showForm && (
          <form className="meeting-notes-form" onSubmit={handleSubmit}>
            <h3 className="meeting-notes-form-title">New meeting note</h3>

            <div className="meeting-notes-form-row">
              <div className="meeting-notes-form-field">
                <label htmlFor="meeting-date">Date</label>
                <input
                  id="meeting-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((d) => ({ ...d, date: e.target.value }))}
                  required
                  className="meeting-notes-input"
                />
              </div>
              <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                <label htmlFor="meeting-title">Title</label>
                <input
                  id="meeting-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                  required
                  placeholder="e.g. Supervision meeting"
                  className="meeting-notes-input"
                />
              </div>
            </div>

            <div className="meeting-notes-form-row">
              <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                <label htmlFor="meeting-participants">Participants</label>
                <input
                  id="meeting-participants"
                  type="text"
                  value={formData.participants}
                  onChange={(e) => setFormData((d) => ({ ...d, participants: e.target.value }))}
                  placeholder="e.g. Dr. Smith, Jane (co-supervisor)"
                  className="meeting-notes-input"
                />
              </div>
              <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                <label htmlFor="meeting-location">Location</label>
                <input
                  id="meeting-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((d) => ({ ...d, location: e.target.value }))}
                  placeholder="e.g. Room 101, Zoom"
                  className="meeting-notes-input"
                />
              </div>
            </div>

            <div className="meeting-notes-form-field">
              <label htmlFor="meeting-content">Content / Notes</label>
              <p className="meeting-notes-format-hint">
                <kbd>⌘B</kbd> / <kbd>Ctrl+B</kbd> for <strong>bold</strong>. Start a line with{' '}
                <code>- </code> for a bullet; <kbd>Enter</kbd> continues the list; <kbd>Tab</kbd> /{' '}
                <kbd>Shift+Tab</kbd> indent / outdent.
              </p>
              <textarea
                id="meeting-content"
                value={formData.content}
                onChange={(e) => setFormData((d) => ({ ...d, content: e.target.value }))}
                onKeyDown={(e) =>
                  handleRichTextareaKeyDown(e, formData.content, (next) =>
                    setFormData((d) => ({ ...d, content: next }))
                  )
                }
                rows={8}
                placeholder={"Key points, decisions, action items…\n- First bullet\n- Second bullet"}
                className="meeting-notes-textarea"
              />
            </div>

            <button type="submit" className="meeting-notes-submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save meeting note'}
            </button>
          </form>
        )}
      </section>
      )}

      <section className="meeting-notes-history-section">
        <h3 className="meeting-notes-history-title">
          Meeting notes
          {notes.length > 0 && (
            <span className="meeting-notes-entry-count">
              {' '}({filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'})
            </span>
          )}
        </h3>
        <div className="meeting-notes-filters">
          <input
            type="search"
            placeholder="Search by title, content, participants, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="meeting-notes-search"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="meeting-notes-date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="meeting-notes-date"
          />
        </div>
        <div className="meeting-notes-entries">
          {filteredNotes.map((note) => {
            const isExpanded = expandedId === note.id;
            const isEditing = editingId === note.id;
            return (
            <article
              key={note.id}
              className={`meeting-notes-entry${isExpanded || isEditing ? ' is-open' : ''}`}
            >
              {isEditing ? (
                <form className="meeting-notes-edit-form" onSubmit={handleSaveEdit}>
                  <div className="meeting-notes-form-row">
                    <div className="meeting-notes-form-field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                        required
                        className="meeting-notes-input"
                      />
                    </div>
                    <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                      <label>Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        required
                        className="meeting-notes-input"
                      />
                    </div>
                  </div>
                  <div className="meeting-notes-form-row">
                    <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                      <label>Participants</label>
                      <input
                        type="text"
                        value={editForm.participants}
                        onChange={(e) => setEditForm((f) => ({ ...f, participants: e.target.value }))}
                        className="meeting-notes-input"
                      />
                    </div>
                    <div className="meeting-notes-form-field meeting-notes-form-field-flex">
                      <label>Location</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                        className="meeting-notes-input"
                      />
                    </div>
                  </div>
                  <div className="meeting-notes-form-field">
                    <label>Content</label>
                    <p className="meeting-notes-format-hint">
                      <kbd>⌘B</kbd> / <kbd>Ctrl+B</kbd> for <strong>bold</strong>. Use <code>- </code> for
                      bullets; <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> to indent.
                    </p>
                    <textarea
                      value={editForm.content}
                      onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                      onKeyDown={(e) =>
                        handleRichTextareaKeyDown(e, editForm.content, (next) =>
                          setEditForm((f) => ({ ...f, content: next }))
                        )
                      }
                      rows={6}
                      className="meeting-notes-textarea"
                    />
                  </div>
                  <div className="meeting-notes-edit-actions">
                    <button type="submit" className="meeting-notes-btn meeting-notes-btn-primary" disabled={saving}>
                      Save
                    </button>
                    <button type="button" className="meeting-notes-btn meeting-notes-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="meeting-notes-entry-summary"
                    onClick={() => toggleExpanded(note.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="meeting-notes-entry-chevron" aria-hidden="true">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <time className="meeting-notes-entry-date" dateTime={note.date}>
                      {formatDate(note.date)}
                    </time>
                    <span className="meeting-notes-entry-title">{note.title}</span>
                    <span className="meeting-notes-entry-participants">
                      {note.participants?.trim() || '—'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="meeting-notes-entry-detail">
                      <div className="meeting-notes-entry-detail-bar">
                        {note.location && (
                          <p className="meeting-notes-entry-meta">
                            Location: {note.location}
                          </p>
                        )}
                        <div className="meeting-notes-entry-actions">
                          {canEditMeetingNotes && (
                            <button
                              type="button"
                              className="meeting-notes-entry-action"
                              onClick={() => startEdit(note)}
                            >
                              Edit
                            </button>
                          )}
                          {canEditMeetingNotes && (
                            <button
                              type="button"
                              className="meeting-notes-entry-action meeting-notes-entry-action-delete"
                              onClick={() => handleDelete(note.id)}
                              disabled={deletingId === note.id}
                            >
                              {deletingId === note.id ? '…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                      {note.content ? (
                        <div className="meeting-notes-entry-reflection">
                          <FormatDiaryText text={note.content} />
                        </div>
                      ) : (
                        <p className="meeting-notes-entry-empty-content">No notes recorded.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
            );
          })}
          {filteredNotes.length === 0 && !loading && (
            <p className="meeting-notes-empty">No meeting notes yet. Add one above.</p>
          )}
        </div>
      </section>
    </>
      )}
    </div>
  );
}
