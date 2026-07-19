import { useEffect, useState, type FormEvent } from 'react';
import { signOut } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { getUserInitials } from '../lib/userInitials';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

function appHref(path: string) {
  return `${base}${path.replace(/^\//, '')}`;
}

export default function ProfilePage() {
  const { loading, isSignedIn, user, role, memberships, primaryProjectId } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [bio, setBio] = useState('');
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
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setErr(error.message);
          return;
        }
        const p = profile as { display_name?: string | null; email?: string | null } | null;
        setDisplayName(p?.display_name ?? (user.user_metadata?.full_name as string) ?? '');
        if (p?.email) setEmail(p.email);

        // Optional extras stored in user metadata until a dedicated columns migration
        const meta = user.user_metadata ?? {};
        setAffiliation(typeof meta.affiliation === 'string' ? meta.affiliation : '');
        setBio(typeof meta.bio === 'string' ? meta.bio : '');

        if (primaryProjectId) {
          const { data: proj } = await supabase
            .from('projects')
            .select('name')
            .eq('id', primaryProjectId)
            .maybeSingle();
          if (!cancelled && proj && typeof proj === 'object' && 'name' in proj) {
            setProjectName(String((proj as { name: string }).name));
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load profile');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.user_metadata, primaryProjectId]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user?.id) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email ?? email,
        display_name: displayName.trim() || null,
        updated_at: new Date().toISOString(),
      } as never);
      if (profileErr) throw profileErr;

      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          full_name: displayName.trim() || null,
          affiliation: affiliation.trim() || null,
          bio: bio.trim() || null,
        },
      });
      if (metaErr) throw metaErr;

      setMsg('Profile saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return <p className="auth-banner auth-banner-warn">Supabase is not configured.</p>;
  }

  if (loading) return <p className="auth-muted">Loading…</p>;

  if (!isSignedIn) {
    return (
      <p className="auth-banner auth-banner-warn">
        <a href={appHref('login/')}>Sign in</a> to view your profile.
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
            {role ? (
              <>
                {' '}
                · <strong>{role}</strong>
              </>
            ) : null}
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
        <p className="auth-muted">
          Initials on the avatar come from this name (e.g. Laurens Goormachtigha → LG).
        </p>

        <label className="auth-label" htmlFor="profile-email">
          Email
          <input id="profile-email" className="auth-input" value={email} disabled readOnly />
        </label>

        <label className="auth-label" htmlFor="profile-affiliation">
          Affiliation
          <input
            id="profile-affiliation"
            className="auth-input"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            placeholder="Stellenbosch Business School"
          />
        </label>

        <label className="auth-label" htmlFor="profile-bio">
          About you
          <textarea
            id="profile-bio"
            className="auth-input profile-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short note about your PhD focus, role, or research interests…"
          />
        </label>

        <button type="submit" className="auth-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {msg && <p className="auth-banner auth-banner-ok">{msg}</p>}
      {err && <p className="auth-banner auth-banner-warn">{err}</p>}

      {memberships.length === 0 && (
        <p className="auth-banner auth-banner-warn">
          You are not on a project yet. Visit <a href={appHref('login/')}>Sign in</a> to claim ownership, or ask
          for an invite.
        </p>
      )}

      <div className="profile-actions">
        <a className="auth-link" href={appHref('members/')}>
          Project members
        </a>
        <button
          type="button"
          className="auth-btn auth-btn-ghost"
          onClick={() => void signOut().then(() => window.location.assign(appHref('login/')))}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
