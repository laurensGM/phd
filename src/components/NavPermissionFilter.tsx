import { useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { PermissionKey } from '../lib/permissions';

/**
 * Hides nav anchors marked with data-requires-permission when the user lacks that permission.
 */
export default function NavPermissionFilter() {
  const { can, loading } = usePermissions();

  useEffect(() => {
    if (loading) return;
    const nodes = document.querySelectorAll<HTMLElement>('[data-requires-permission]');
    nodes.forEach((el) => {
      const key = el.getAttribute('data-requires-permission') as PermissionKey | null;
      if (!key) return;
      const allowed = can(key);
      el.style.display = allowed ? '' : 'none';
      const item = el.closest('li');
      if (item) item.hidden = !allowed;
    });
  }, [can, loading]);

  return null;
}
