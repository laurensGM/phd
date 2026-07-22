import { useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { PermissionKey } from '../lib/permissions';
import AccessDenied from './AccessDenied';
import CheckingAccess from './CheckingAccess';

/**
 * Gates Astro page content marked with data-requires-permission-content="{permission}".
 * Shows a spinner while permissions load; AccessDenied only after the check settles.
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
    return <CheckingAccess />;
  }

  if (!allowed) {
    return <AccessDenied message={message} permission={permission} />;
  }

  return null;
}
