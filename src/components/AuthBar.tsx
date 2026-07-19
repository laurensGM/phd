import { useEffect, useRef, useState } from 'react';
import { signOut } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { getUserInitials } from '../lib/userInitials';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ViewAsControls } from './ViewAsBanner';
import { viewAsLabel, writeViewAsRole } from '../lib/viewAs';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

function appHref(path: string) {
  return `${base}${path.replace(/^\//, '')}`;
}

export default function AuthBar() {
  const {
    loading,
    isSignedIn,
    user,
    role,
    memberships,
    isSuperadmin,
    isRealSuperadmin,
    isViewingAs,
    viewAsRole,
    effectiveRole,
  } = useAuth();
  const configured = isSupabaseConfigured();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setDisplayName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn('Could not load profile display name', error.message);
          setDisplayName((user.user_metadata?.full_name as string | undefined) ?? null);
          return;
        }
        const name =
          (data as { display_name?: string | null } | null)?.display_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          null;
        setDisplayName(name);
      } catch (err) {
        if (!cancelled) console.warn('Profile fetch failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata?.full_name]);

  useEffect(() => {
    if (!supabase || !isRealSuperadmin || !isSignedIn) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const loadUnread = async () => {
      const { count, error } = await supabase
        .from('feedback_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unread');
      if (cancelled) return;
      if (error) {
        console.warn('Could not load inbox unread count', error.message);
        return;
      }
      setUnreadCount(count ?? 0);
    };
    void loadUnread();
    const onFocus = () => void loadUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [isRealSuperadmin, isSignedIn, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
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

  if (!configured) {
    return (
      <div className="nav-profile">
        <a className="nav-sign-in" href={appHref('login/')}>
          Sign in
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="nav-profile nav-profile-loading" aria-hidden="true">
        <span className="nav-avatar nav-avatar-skeleton" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="nav-profile">
        <a className="nav-sign-in" href={appHref('login/')}>
          Sign in
        </a>
      </div>
    );
  }

  const email = user?.email ?? '';
  const initials = getUserInitials({ email, displayName });
  const noProject = memberships.length === 0;
  const roleLabel = isViewingAs
    ? `viewing as ${viewAsLabel(viewAsRole)}`
    : effectiveRole || role;

  const onLogout = () => {
    setOpen(false);
    writeViewAsRole(null);
    void signOut().then(() => {
      window.location.assign(appHref('login/'));
    });
  };

  return (
    <div className="nav-profile" ref={rootRef}>
      <button
        type="button"
        className={`nav-avatar${isViewingAs ? ' nav-avatar-view-as' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email || 'signed-in user'}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initials}
        {isRealSuperadmin && unreadCount > 0 && <span className="nav-avatar-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="nav-profile-menu" role="menu">
          <div className="nav-profile-menu-header">
            <div className="nav-avatar nav-avatar-lg" aria-hidden="true">
              {initials}
            </div>
            <div className="nav-profile-menu-meta">
              {displayName && <div className="nav-profile-menu-name">{displayName}</div>}
              <div className="nav-profile-menu-email">{email}</div>
              {roleLabel && <div className="nav-profile-menu-role">{roleLabel}</div>}
            </div>
          </div>
          {noProject && (
            <p className="nav-profile-menu-warn">
              Not on a project yet. Open Login once if you are the owner, or wait for an invite.
            </p>
          )}
          <a className="nav-profile-menu-item" role="menuitem" href={appHref('profile/')}>
            Profile
          </a>
          {isRealSuperadmin && (
            <a className="nav-profile-menu-item nav-profile-menu-inbox" role="menuitem" href={appHref('inbox/')}>
              Inbox
              {unreadCount > 0 && (
                <span className="nav-inbox-badge" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </a>
          )}
          {isSuperadmin && (
            <a
              className="nav-profile-menu-item nav-profile-menu-admin"
              role="menuitem"
              href={appHref('admin/')}
            >
              Admin panel
            </a>
          )}
          {isRealSuperadmin && <ViewAsControls compact />}
          <a className="nav-profile-menu-item" role="menuitem" href={appHref('members/')}>
            Project members
          </a>
          <button
            type="button"
            className="nav-profile-menu-item nav-profile-menu-logout"
            role="menuitem"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
