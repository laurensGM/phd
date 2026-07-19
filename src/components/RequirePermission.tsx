import { useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { PermissionKey } from '../lib/permissions';
import AccessDenied from './AccessDenied';

/**
 * Gates Astro page content marked with data-requires-permission-content="{permission}".
 * Renders AccessDenied when the current role lacks the permission.
 */
export default function RequirePermission({
  permission,
  message = 'Your role cannot view this page.',
}: {
  permission: PermissionKey;
  message?: string;
}) {
  const { loading, can } = usePermissions();
  const allowed = can(permission);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      `[data-requires-permission-content="${permission}"]`
    );
    nodes.forEach((el) => {
      el.hidden = loading || !allowed;
    });
  }, [loading, allowed, permission]);

  if (loading) {
    return <p className="access-checking">Checking access…</p>;
  }

  if (!allowed) {
    return <AccessDenied message={message} permission={permission} />;
  }

  return null;
}
