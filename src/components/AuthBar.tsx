import { signOut } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';

const base = import.meta.env.BASE_URL || '/';

export default function AuthBar() {
  const { loading, configured, isSignedIn, user, role, memberships } = useAuth();

  if (!configured) return null;

  if (loading) {
    return <div className="auth-bar auth-bar-muted">Checking sign-in…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="auth-bar auth-bar-warn">
        <span>Sign in to load and edit your PhD data.</span>
        <a className="auth-bar-link" href={`${base}login/`}>
          Sign in
        </a>
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className="auth-bar auth-bar-warn">
        <span>
          Signed in as {user?.email}, but not on a project yet. Ask for an invite, or open Login once if
          you are the owner.
        </span>
        <a className="auth-bar-link" href={`${base}login/`}>
          Login
        </a>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <span className="auth-bar-user">
        {user?.email}
        {role ? <span className="auth-bar-role"> · {role}</span> : null}
      </span>
      <a className="auth-bar-link" href={`${base}members/`}>
        Members
      </a>
      <button
        type="button"
        className="auth-bar-btn"
        onClick={() => void signOut().then(() => (window.location.href = `${base}login/`))}
      >
        Sign out
      </button>
    </div>
  );
}
