/** Permission keys matching `app_permissions` / admin matrix. */

import { ALL_NAV_PERMISSION_ITEMS } from './navPermissions';

export type AppPermissionRole = 'superadmin' | 'student' | 'supervisor';

export type PermissionKey = (typeof ALL_NAV_PERMISSION_ITEMS)[number]['key'];

export const PERMISSION_KEYS: PermissionKey[] = ALL_NAV_PERMISSION_ITEMS.map((i) => i.key);

const STUDENT_DENIED = new Set<PermissionKey>([
  'nav.manager.admin',
  'nav.writing.humanize',
  'nav.writing.lr_process',
]);

const SUPERVISOR_DENIED = new Set<PermissionKey>([
  'nav.manager.diary',
  'nav.manager.admin',
  'nav.manager.members',
  'nav.writing.humanize',
  'nav.writing.lr_process',
]);

function buildRoleDefaults(denied: Set<PermissionKey>): Record<PermissionKey, boolean> {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, !denied.has(k)])
  ) as Record<PermissionKey, boolean>;
}

/** Defaults matching the seeded admin matrix. */
export const DEFAULT_ROLE_PERMISSIONS: Record<AppPermissionRole, Record<PermissionKey, boolean>> = {
  superadmin: buildRoleDefaults(new Set()),
  student: buildRoleDefaults(STUDENT_DENIED),
  supervisor: buildRoleDefaults(SUPERVISOR_DENIED),
};

/** Keys denied for view-as flash prevention (inline nav script). */
export function deniedKeysForViewAs(role: 'student' | 'supervisor'): PermissionKey[] {
  return PERMISSION_KEYS.filter((k) => !DEFAULT_ROLE_PERMISSIONS[role][k]);
}

/**
 * Edit within a nav area: student/superadmin with access can edit;
 * supervisors are read-only except meeting notes.
 */
export function canEditWithNavAccess(
  hasNavAccess: boolean,
  permissionRole: AppPermissionRole | null,
  opts?: { supervisorMayEdit?: boolean }
): boolean {
  if (!hasNavAccess || !permissionRole) return false;
  if (permissionRole === 'supervisor') return !!opts?.supervisorMayEdit;
  return true;
}

export type ProjectRole = 'owner' | 'student' | 'supervisor';
export type ViewAsRole = 'student' | 'supervisor';

export function resolvePermissionRole(opts: {
  isRealSuperadmin: boolean;
  isViewingAs: boolean;
  viewAsRole: ViewAsRole | null;
  role: ProjectRole | null;
}): AppPermissionRole | null {
  // Only honor view-as once we know the user is a real superadmin (avoids a deny flash
  // while memberships / is_superadmin are still loading).
  if (opts.isRealSuperadmin && opts.viewAsRole) return opts.viewAsRole;
  if (opts.isRealSuperadmin) return 'superadmin';
  if (opts.role === 'supervisor') return 'supervisor';
  if (opts.role === 'owner' || opts.role === 'student') return 'student';
  return null;
}
