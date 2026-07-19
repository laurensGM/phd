import { useEffect, useState, type FormEvent } from 'react';
import { signOut } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { getUserInitials } from '../lib/userInitials';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const base = import.meta.env.BASE_URL || '/';

export default function ProfilePage() {
  const { loading, isSignedIn, user, role, memberships, primaryProjectId } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    setEmail(user.email ?? '');
    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = profile as { display_name?: string | null; email?: string | null } | null;
      setDisplayName(p?.display_name ?? (user.user_metadata?.full_name as string) ?? '');
      if (p?.email) setEmail(p.email);

      if (primaryProjectId) {
        const { data: proj } = await supabase.from('projects').select('name').eq('id', primaryProjectId).maybeSingle();
        if (!cancelled && proj && typeof proj === 'object' && 'name' in proj) {
          setProjectName(String((proj as { name: string }).name));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.user_metadata?.full_name, primaryProjectId]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user?.id) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? email,
      display_name: displayName.trim() || null,
      updated_at: new Date().toISOString(),
    } as never);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg('Profile saved.');
  };

  if (!isSupabaseConfigured()) {
    return <p className="auth-banner auth-banner-warn">Supabase is not configured.</p>;
  }

  if (loading) return <p className="auth-muted">Loading…</p>;

  if (!isSignedIn) {
    return (
      <p className="auth-banner auth-banner-warn">
        <a href={`${base}login/`}>Sign in</a> to view your profile.
      </p>
    );
  }

  const initials = getUserInitials({ email, displayName });

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="nav-avatar nav-avatar-xl" aria-hidden="true">
          {initials}
        </div>
        <div>
          <h2 className="profile-heading">{displayName.trim() || email || 'Your profile'}</h2>
          <p className="auth-muted">
            {email}
            {role ? <> · <strong>{role}</strong></> : null}
            {projectName ? <> · {projectName}</> : null}
          </p>
        </div>
      </div>

      <form className="auth-form profile-form" onSubmit={(e) => void onSave(e)}>
        <label className="auth-label" htmlFor="profile-display-name">
          Display name
          <input
            id="profile-display-name"
            className="auth-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Laurens Goormachtigha"
          />
        </label>
        <p className="auth-muted">Initials on the avatar come from this name (e.g. Laurens Goormachtigha → LG).</p>
        <label className="auth-label" htmlFor="profile-email">
          Email
          <input id="profile-email" className="auth-input" value={email} disabled readOnly />
        </label>
        <button type="submit" className="auth-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {msg && <p className="auth-banner auth-banner-ok">{msg}</p>}
      {err && <p className="auth-banner auth-banner-warn">{err}</p>}

      {memberships.length === 0 && (
        <p className="auth-banner auth-banner-warn">
          You are not on a project yet. Visit <a href={`${base}login/`}>Sign in</a> to claim ownership, or ask for an
          invite.
        </p>
      )}

      <div className="profile-actions">
        <a className="auth-link" href={`${base}members/`}>
          Project members
        </a>
        <button
          type="button"
          className="auth-btn auth-btn-ghost"
          onClick={() => void signOut().then(() => (window.location.href = `${base}login/`))}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
