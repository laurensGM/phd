import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';

type SharedDocument = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeGoogleDoc(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'docs.google.com' ||
      host === 'drive.google.com' ||
      host.endsWith('.google.com')
    );
  } catch {
    return false;
  }
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { loading: permLoading, canViewDocuments, canEditDocuments } = usePermissions();
  const [docs, setDocs] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from('shared_documents')
      .select('id, title, url, notes, created_at, updated_at, created_by')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (fetchErr) {
      setError(fetchErr.message);
      setDocs([]);
      return;
    }
    setDocs((data ?? []) as SharedDocument[]);
  }, []);

  useEffect(() => {
    if (!permLoading && canViewDocuments) void load();
    else if (!permLoading) setLoading(false);
  }, [permLoading, canViewDocuments, load]);

  const resetAddForm = () => {
    setTitle('');
    setUrl('');
    setNotes('');
    setShowForm(false);
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditDocuments || !supabase || !user?.id) return;
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) {
      setError('Title and link are required.');
      return;
    }
    if (!isHttpUrl(u)) {
      setError('Please paste a valid http(s) link (e.g. a Google Doc URL).');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('shared_documents').insert({
      title: t,
      url: u,
      notes: notes.trim() || null,
      created_by: user.id,
    } as never);
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    resetAddForm();
    void load();
  };

  const startEdit = (doc: SharedDocument) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditUrl(doc.url);
    setEditNotes(doc.notes ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
    setEditNotes('');
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditDocuments || !supabase || !editingId) return;
    const t = editTitle.trim();
    const u = editUrl.trim();
    if (!t || !u) {
      setError('Title and link are required.');
      return;
    }
    if (!isHttpUrl(u)) {
      setError('Please paste a valid http(s) link.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: upErr } = await supabase
      .from('shared_documents')
      .update({
        title: t,
        url: u,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', editingId);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    cancelEdit();
    void load();
  };

  const onDelete = async (id: string) => {
    if (!canEditDocuments || !supabase) return;
    if (!window.confirm('Remove this document link from the list? (The Google Doc itself is unchanged.)')) {
      return;
    }
    setError(null);
    const { error: delErr } = await supabase.from('shared_documents').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (editingId === id) cancelEdit();
    void load();
  };

  if (!isSupabaseConfigured()) {
    return (
      <p className="docs-muted">
        Configure Supabase to share document links with your supervisors.
      </p>
    );
  }

  if (permLoading || loading) {
    return <p className="docs-muted">Loading documents…</p>;
  }

  if (!canViewDocuments) {
    return (
      <AccessDenied
        message="Your role cannot view shared documents."
        permission="nav.manager.documents"
      />
    );
  }

  return (
    <div className="docs-page">
      {error && (
        <p className="docs-error" role="alert">
          {error}
        </p>
      )}

      {canEditDocuments && (
        <section className="docs-add-section">
          {!showForm ? (
            <button type="button" className="docs-add-btn" onClick={() => setShowForm(true)}>
              Add document link
            </button>
          ) : (
            <form className="docs-form" onSubmit={(e) => void onAdd(e)}>
              <h2 className="docs-form-title">Share a document</h2>
              <p className="docs-hint">
                Paste a Google Doc (or Drive) link your supervisors can open. Share the Doc with their
                Google accounts if it isn’t already public/shared.
              </p>
              <label className="docs-field">
                Title
                <input
                  className="docs-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 2 draft — April"
                  required
                  maxLength={200}
                />
              </label>
              <label className="docs-field">
                Link
                <input
                  className="docs-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/…"
                  required
                />
              </label>
              {url.trim() && isHttpUrl(url) && !looksLikeGoogleDoc(url) && (
                <p className="docs-warn">
                  This doesn’t look like a Google Docs/Drive link — that’s fine if you meant another
                  shared artefact.
                </p>
              )}
              <label className="docs-field">
                Notes <span className="docs-optional">(optional)</span>
                <textarea
                  className="docs-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What to focus on, deadline, version…"
                />
              </label>
              <div className="docs-form-actions">
                <button type="submit" className="docs-submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save link'}
                </button>
                <button type="button" className="docs-cancel" onClick={resetAddForm} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {!canEditDocuments && (
        <p className="docs-hint docs-hint-standalone">
          Open a link below to read the shared document. Only the student can add or remove links
          here.
        </p>
      )}

      {docs.length === 0 ? (
        <p className="docs-empty">
          {canEditDocuments
            ? 'No shared documents yet. Add a Google Doc link above.'
            : 'No shared documents yet.'}
        </p>
      ) : (
        <ul className="docs-list">
          {docs.map((doc) => (
            <li key={doc.id} className="docs-item">
              {editingId === doc.id && canEditDocuments ? (
                <form className="docs-form docs-form-edit" onSubmit={(e) => void onSaveEdit(e)}>
                  <label className="docs-field">
                    Title
                    <input
                      className="docs-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      maxLength={200}
                    />
                  </label>
                  <label className="docs-field">
                    Link
                    <input
                      className="docs-input"
                      type="url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      required
                    />
                  </label>
                  <label className="docs-field">
                    Notes
                    <textarea
                      className="docs-textarea"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                  </label>
                  <div className="docs-form-actions">
                    <button type="submit" className="docs-submit" disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" className="docs-cancel" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="docs-item-main">
                    <h2 className="docs-item-title">{doc.title}</h2>
                    {doc.notes && <p className="docs-item-notes">{doc.notes}</p>}
                    <p className="docs-item-meta">
                      Added {new Date(doc.created_at).toLocaleString()}
                      {looksLikeGoogleDoc(doc.url) && (
                        <span className="docs-badge">Google</span>
                      )}
                    </p>
                  </div>
                  <div className="docs-item-actions">
                    <a
                      className="docs-open"
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open document
                    </a>
                    {canEditDocuments && (
                      <>
                        <button type="button" className="docs-btn-secondary" onClick={() => startEdit(doc)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="docs-btn-danger"
                          onClick={() => void onDelete(doc.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
