import { useEffect, useId, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type FeedbackKind = 'feature' | 'bug';

export default function FeedbackWidget() {
  const { loading, isSignedIn, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('feature');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = (e.target as HTMLElement | null)?.closest?.('.feedback-fab');
        if (!btn) setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const resetForm = () => {
    setKind('feature');
    setSubject('');
    setBody('');
    setError(null);
    setDone(false);
  };

  const toggle = () => {
    setOpen((v) => {
      if (v) resetForm();
      return !v;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !isSupabaseConfigured() || !user?.id) return;
    const text = body.trim();
    if (!text) {
      setError('Please write a short message.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('feedback_messages').insert({
      author_id: user.id,
      author_email: user.email ?? null,
      author_name:
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        null,
      kind,
      subject: subject.trim() || null,
      body: text,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
      status: 'unread',
    } as never);
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDone(true);
    window.setTimeout(() => {
      setOpen(false);
      resetForm();
    }, 1600);
  };

  if (!isSupabaseConfigured() || loading || !isSignedIn) return null;

  return (
    <div className="feedback-widget" ref={panelRef}>
      {open && (
        <div className="feedback-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="feedback-panel-head">
            <h2 id={titleId} className="feedback-panel-title">
              Send feedback
            </h2>
            <button type="button" className="feedback-panel-close" onClick={toggle} aria-label="Close">
              ×
            </button>
          </div>

          {done ? (
            <p className="feedback-thanks" role="status">
              Thanks — your message was sent.
            </p>
          ) : (
            <form className="feedback-form" onSubmit={(e) => void submit(e)}>
              <div className="feedback-kind" role="group" aria-label="Feedback type">
                <button
                  type="button"
                  className={`feedback-kind-btn${kind === 'feature' ? ' is-active' : ''}`}
                  onClick={() => setKind('feature')}
                >
                  Feature idea
                </button>
                <button
                  type="button"
                  className={`feedback-kind-btn${kind === 'bug' ? ' is-active' : ''}`}
                  onClick={() => setKind('bug')}
                >
                  Bug report
                </button>
              </div>

              <label className="feedback-field">
                Subject <span className="feedback-optional">(optional)</span>
                <input
                  className="feedback-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder={kind === 'bug' ? 'What went wrong?' : 'What would help?'}
                />
              </label>

              <label className="feedback-field">
                Message
                <textarea
                  className="feedback-textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  required
                  placeholder="Keep it short — a few sentences is enough."
                />
              </label>

              {error && (
                <p className="feedback-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="feedback-submit" disabled={saving || !body.trim()}>
                {saving ? 'Sending…' : 'Send'}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        className={`feedback-fab${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-label={open ? 'Close feedback form' : 'Send feedback or report a bug'}
        onClick={toggle}
      >
        {open ? '×' : '?'}
      </button>
    </div>
  );
}
