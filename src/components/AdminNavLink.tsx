import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const CACHE_KEY = 'phd_is_superadmin';

/** Persistent Admin CTA — visible on every page for the sole superadmin. */
export default function AdminNavLink() {
  const { loading, isSignedIn, isSuperadmin } = useAuth();
  const [cached, setCached] = useState(() => {
    try {
      return sessionStorage.getItem(CACHE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isSignedIn) {
      try {
        sessionStorage.removeItem(CACHE_KEY);
      } catch {
        /* ignore */
      }
      setCached(false);
      return;
    }
    if (!loading) {
      try {
        if (isSuperadmin) sessionStorage.setItem(CACHE_KEY, '1');
        else sessionStorage.removeItem(CACHE_KEY);
      } catch {
        /* ignore */
      }
      setCached(isSuperadmin);
    }
  }, [loading, isSignedIn, isSuperadmin]);

  const show = isSignedIn && (isSuperadmin || (loading && cached));
  if (!show) return null;

  return (
    <a className="nav-admin-link" href={`${base}admin/`} title="Admin · Roles & permissions">
      Admin
    </a>
  );
}
