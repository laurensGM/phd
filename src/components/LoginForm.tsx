import { useState, type FormEvent } from 'react';
import { signInWithMagicLink } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

const base = import.meta.env.BASE_URL || '/';

export default function LoginForm() {
  const { loading, isSignedIn, user, memberships, role, error: authError, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSending(true);
    try {
      await signInWithMagicLink(email);
      setMessage('Check your email for a magic link to sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setSending(false);
    }
  };

  if (!configured || !isSupabaseConfigured()) {
    return (
      <p className="auth-banner auth-banner-warn">
        Supabase is not configured. Add <code>PUBLIC_SUPABASE_URL</code> and{' '}
        <code>PUBLIC_SUPABASE_ANON_KEY</code>.
      </p>
    );
  }

  if (loading) {
    return <p className="auth-muted">Checking session…</p>;
  }

  if (isSignedIn) {
    return (
      <div className="auth-card">
        <h2 className="auth-card-title">Signed in</h2>
        <p className="auth-muted">
          {user?.email}
          {role ? <> · role: <strong>{role}</strong></> : null}
        </p>
        {memberships.length === 0 ? (
          <p className="auth-banner auth-banner-warn">
            You are signed in but not a member of any project yet. Ask the project owner to invite{' '}
            <strong>{user?.email}</strong>, then refresh this page.
          </p>
        ) : (
          <p className="auth-banner auth-banner-ok">
            Project access is ready. You can use Papers, Snippets, Claims, and the rest of the app.
          </p>
        )}
        {authError && <p className="auth-banner auth-banner-warn">{authError}</p>}
        <p>
          <a className="auth-link" href={`${base}`}>
            Go to home
          </a>
          {' · '}
          <a className="auth-link" href={`${base}members/`}>
            Project members
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2 className="auth-card-title">Sign in with email</h2>
      <p className="auth-muted">
        We email you a one-time magic link. No password. Use the same email your project owner invited.
      </p>
      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="auth-label" htmlFor="login-email">
          Email
          <input
            id="login-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.ac.za"
            required
          />
        </label>
        <button type="submit" className="auth-btn" disabled={sending}>
          {sending ? 'Sending…' : 'Email magic link'}
        </button>
      </form>
      {message && <p className="auth-banner auth-banner-ok">{message}</p>}
      {error && <p className="auth-banner auth-banner-warn">{error}</p>}
    </div>
  );
}
