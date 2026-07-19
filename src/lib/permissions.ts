/** Permission keys matching `app_permissions` / admin matrix. */

export type AppPermissionRole = 'superadmin' | 'student' | 'supervisor';

export type PermissionKey =
  | 'admin.access'
  | 'members.manage'
  | 'papers.view'
  | 'papers.edit'
  | 'snippets.view'
  | 'snippets.edit'
  | 'claims.view'
  | 'claims.edit'
  | 'diary.view'
  | 'diary.edit'
  | 'tasks.view'
  | 'tasks.edit'
  | 'meeting_notes.view'
  | 'meeting_notes.edit'
  | 'documents.view'
  | 'documents.edit';

export const PERMISSION_KEYS: PermissionKey[] = [
  'admin.access',
  'members.manage',
  'papers.view',
  'papers.edit',
  'snippets.view',
  'snippets.edit',
  'claims.view',
  'claims.edit',
  'diary.view',
  'diary.edit',
  'tasks.view',
  'tasks.edit',
  'meeting_notes.view',
  'meeting_notes.edit',
  'documents.view',
  'documents.edit',
];

/** Defaults matching the seeded admin matrix (screenshot). */
export const DEFAULT_ROLE_PERMISSIONS: Record<AppPermissionRole, Record<PermissionKey, boolean>> = {
  superadmin: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Record<PermissionKey, boolean>,
  student: Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, k !== 'admin.access'])
  ) as Record<PermissionKey, boolean>,
  supervisor: {
    'admin.access': false,
    'members.manage': false,
    'papers.view': true,
    'papers.edit': false,
    'snippets.view': true,
    'snippets.edit': false,
    'claims.view': true,
    'claims.edit': false,
    'diary.view': false,
    'diary.edit': false,
    'tasks.view': true,
    'tasks.edit': false,
    'meeting_notes.view': true,
    'meeting_notes.edit': true,
    'documents.view': true,
    'documents.edit': false,
  },
};

export type ProjectRole = 'owner' | 'student' | 'supervisor';
export type ViewAsRole = 'student' | 'supervisor';

export function resolvePermissionRole(opts: {
  isRealSuperadmin: boolean;
  isViewingAs: boolean;
  viewAsRole: ViewAsRole | null;
  role: ProjectRole | null;
}): AppPermissionRole | null {
  // Prefer stored view-as even before isRealSuperadmin finishes loading.
  // Otherwise nav briefly (or stuck) treats the user as full superadmin after navigation.
  if (opts.viewAsRole) return opts.viewAsRole;
  if (opts.isRealSuperadmin) return 'superadmin';
  if (opts.role === 'supervisor') return 'supervisor';
  if (opts.role === 'owner' || opts.role === 'student') return 'student';
  return null;
}
