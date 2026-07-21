import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { permissionKeyForPath } from '../lib/navPermissions';
import type { PermissionKey } from '../lib/permissions';
import AccessDenied from './AccessDenied';

/**
 * Blocks signed-in users who lack the nav permission for the current page path.
 */
export default function PagePermissionGuard() {
  const { isSignedIn } = useAuth();
  const { loading, can, permissionRole } = usePermissions();
  const [permissionKey, setPermissionKey] = useState<PermissionKey | null>(null);

  useEffect(() => {
    setPermissionKey(permissionKeyForPath(window.location.pathname) as PermissionKey | null);
  }, []);

  const needsCheck = isSignedIn && !!permissionRole && !!permissionKey;
  const allowed = !needsCheck || !permissionKey || can(permissionKey);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main-content');
    if (!main) return;
    if (!needsCheck || loading) {
      main.hidden = false;
      return;
    }
    main.hidden = !allowed;
  }, [needsCheck, loading, allowed]);

  if (!needsCheck || loading || !permissionKey) return null;
  if (allowed) return null;

  return (
    <AccessDenied
      message="Your role cannot view this page."
      permission={permissionKey}
    />
  );
}
