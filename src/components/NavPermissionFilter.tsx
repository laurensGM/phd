import { useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
} from '../lib/permissions';
import { readViewAsRole } from '../lib/viewAs';

const DENIED_CLASS = 'nav-perm-denied';

function applyNavPermissionVisibility(can: (key: PermissionKey) => boolean) {
  const nodes = document.querySelectorAll<HTMLElement>('[data-requires-permission]');
  nodes.forEach((el) => {
    const key = el.getAttribute('data-requires-permission') as PermissionKey | null;
    if (!key) return;
    const allowed = can(key);
    el.classList.toggle(DENIED_CLASS, !allowed);
    if (allowed) el.style.removeProperty('display');
    else el.style.setProperty('display', 'none', 'important');
    const item = el.closest('li');
    if (item) {
      item.classList.toggle(DENIED_CLASS, !allowed);
      item.hidden = !allowed;
    }
  });
}

/**
 * Hides nav anchors marked with data-requires-permission when the user lacks that permission.
 */
export default function NavPermissionFilter() {
  const { can, loading, permissionRole } = usePermissions();

  // Sync fallback from session view-as before auth islands finish loading.
  useEffect(() => {
    const viewAs = readViewAsRole();
    if (!viewAs) return;
    const matrix = DEFAULT_ROLE_PERMISSIONS[viewAs];
    applyNavPermissionVisibility((key) => !!matrix[key]);
  }, []);

  useEffect(() => {
    if (loading && !permissionRole) return;
    applyNavPermissionVisibility(can);
  }, [can, loading, permissionRole]);

  return null;
}
