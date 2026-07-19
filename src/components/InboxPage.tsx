import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import AccessDenied from './AccessDenied';

type FeedbackStatus = 'unread' | 'read' | 'archived';
type FeedbackKind = 'feature' | 'bug';

type FeedbackMessage = {
  id: string;
  created_at: string;
  author_id: string | null;
  author_email: string | null;
  author_name: string | null;
  kind: FeedbackKind;
  subject: string | null;
  body: string;
  page_url: string | null;
  status: FeedbackStatus;
  read_at: string | null;
};

type Filter = 'all' | 'unread' | FeedbackKind | 'archived';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

export default function InboxPage() {
  const { loading: authLoading, isSignedIn, isRealSuperadmin } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('unread');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from('feedback_messages')
      .select(
        'id, created_at, author_id, author_email, author_name, kind, subject, body, page_url, status, read_at'
      )
      .order('created_at', { ascending: false });
    setLoading(false);
    if (fetchErr) {
      setError(fetchErr.message);
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as FeedbackMessage[]);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn || !isRealSuperadmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, isSignedIn, isRealSuperadmin, load]);

  const setStatus = async (id: string, status: FeedbackStatus) => {
    if (!supabase) return;
    setBusyId(id);
    setError(null);
    const payload: { status: FeedbackStatus; read_at?: string | null } = { status };
    if (status === 'read' || status === 'archived') {
      payload.read_at = new Date().toISOString();
    }
    if (status === 'unread') {
      payload.read_at = null;
    }
    const { error: upErr } = await supabase
      .from('feedback_messages')
      .update(payload as never)
      .eq('id', id);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status,
              read_at: payload.read_at ?? m.read_at,
            }
          : m
      )
    );
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm('Delete this message permanently?')) return;
    setBusyId(id);
    const { error: delErr } = await supabase.from('feedback_messages').delete().eq('id', id);
    setBusyId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  if (!isSupabaseConfigured()) {
    return <p className="inbox-muted">Supabase is not configured.</p>;
  }

  if (authLoading || loading) {
    return <p className="inbox-muted">Loading inbox…</p>;
  }

  if (!isSignedIn) {
    return (
      <p className="inbox-banner">
        <a href={`${base}login/`}>Sign in</a> to open the inbox.
      </p>
    );
  }

  if (!isRealSuperadmin) {
    return <AccessDenied message="Only the superadmin can open the feedback inbox." />;
  }

  const filtered = messages.filter((m) => {
    if (filter === 'all') return m.status !== 'archived';
    if (filter === 'unread') return m.status === 'unread';
    if (filter === 'archived') return m.status === 'archived';
    if (filter === 'feature' || filter === 'bug') return m.kind === filter && m.status !== 'archived';
    return true;
  });

  const unreadCount = messages.filter((m) => m.status === 'unread').length;

  return (
    <div className="inbox-page">
      <div className="inbox-toolbar">
        <p className="inbox-count">
          {unreadCount === 0 ? 'No unread messages' : `${unreadCount} unread`}
        </p>
        <div className="inbox-filters" role="tablist" aria-label="Filter messages">
          {(
            [
              ['unread', 'Unread'],
              ['all', 'Open'],
              ['feature', 'Features'],
              ['bug', 'Bugs'],
              ['archived', 'Archived'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`inbox-filter${filter === id ? ' is-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="inbox-empty">Nothing here yet.</p>
      ) : (
        <ul className="inbox-list">
          {filtered.map((m) => {
            const busy = busyId === m.id;
            const who = m.author_name || m.author_email || 'Unknown user';
            return (
              <li
                key={m.id}
                className={`inbox-item${m.status === 'unread' ? ' is-unread' : ''}`}
              >
                <div className="inbox-item-head">
                  <span className={`inbox-kind inbox-kind-${m.kind}`}>
                    {m.kind === 'bug' ? 'Bug' : 'Feature'}
                  </span>
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleString()}
                  </time>
                </div>
                {m.subject && <h2 className="inbox-subject">{m.subject}</h2>}
                <p className="inbox-body">{m.body}</p>
                <div className="inbox-meta">
                  <span>From {who}</span>
                  {m.author_email && m.author_name && (
                    <span className="inbox-meta-email">{m.author_email}</span>
                  )}
                  {m.page_url && (
                    <a href={m.page_url} className="inbox-page-link" target="_blank" rel="noreferrer">
                      Page context
                    </a>
                  )}
                </div>
                <div className="inbox-actions">
                  {m.status === 'unread' ? (
                    <button
                      type="button"
                      className="inbox-btn"
                      disabled={busy}
                      onClick={() => void setStatus(m.id, 'read')}
                    >
                      Mark read
                    </button>
                  ) : m.status === 'read' ? (
                    <button
                      type="button"
                      className="inbox-btn"
                      disabled={busy}
                      onClick={() => void setStatus(m.id, 'unread')}
                    >
                      Mark unread
                    </button>
                  ) : null}
                  {m.status !== 'archived' ? (
                    <button
                      type="button"
                      className="inbox-btn"
                      disabled={busy}
                      onClick={() => void setStatus(m.id, 'archived')}
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inbox-btn"
                      disabled={busy}
                      onClick={() => void setStatus(m.id, 'read')}
                    >
                      Unarchive
                    </button>
                  )}
                  <button
                    type="button"
                    className="inbox-btn inbox-btn-danger"
                    disabled={busy}
                    onClick={() => void remove(m.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
