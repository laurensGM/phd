import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { readViewAsRole } from '../lib/viewAs';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const CACHE_KEY = 'phd_is_superadmin';

/** Persistent Admin CTA — real superadmin only; hidden while view-as is active. */
export default function AdminNavLink() {
  const { loading, isSignedIn, isSuperadmin, isRealSuperadmin, isViewingAs } = useAuth();
  const [cached, setCached] = useState(() => {
    try {
      return sessionStorage.getItem(CACHE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [viewAsCached] = useState(() => !!readViewAsRole());

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
        if (isRealSuperadmin) sessionStorage.setItem(CACHE_KEY, '1');
        else sessionStorage.removeItem(CACHE_KEY);
      } catch {
        /* ignore */
      }
      setCached(isRealSuperadmin);
    }
  }, [loading, isSignedIn, isRealSuperadmin]);

  const shadowing = isViewingAs || (loading && viewAsCached);
  if (shadowing) return null;

  const show = isSignedIn && (isSuperadmin || (loading && cached));
  if (!show) return null;

  return (
    <a className="nav-admin-link" href={`${base}admin/`} title="Admin · Roles & permissions">
      Admin
    </a>
  );
}
