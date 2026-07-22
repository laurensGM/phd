import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { permissionKeyForPath } from '../lib/navPermissions';
import type { PermissionKey } from '../lib/permissions';
import AccessDenied from './AccessDenied';
import CheckingAccess from './CheckingAccess';

/**
 * Blocks signed-in users who lack the nav permission for the current page path.
 * Shows a spinner (never Access Denied) until auth + permissions are ready.
 */
export default function PagePermissionGuard() {
  const { isSignedIn } = useAuth();
  const { loading, can, permissionRole } = usePermissions();
  const [permissionKey, setPermissionKey] = useState<PermissionKey | null>(null);

  useEffect(() => {
    setPermissionKey(permissionKeyForPath(window.location.pathname) as PermissionKey | null);
  }, []);

  const gated = !!permissionKey;
  const checking = gated && isSignedIn && loading;
  const needsEnforce = gated && isSignedIn && !loading && !!permissionRole;
  const allowed = !needsEnforce || can(permissionKey!);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main-content');
    if (!main) return;
    if (checking || (needsEnforce && !allowed)) {
      main.hidden = true;
      return;
    }
    main.hidden = false;
  }, [checking, needsEnforce, allowed]);

  if (checking) {
    return <CheckingAccess />;
  }

  if (needsEnforce && !allowed) {
    return (
      <AccessDenied
        message="Your role cannot view this page."
        permission={permissionKey}
      />
    );
  }

  return null;
}
