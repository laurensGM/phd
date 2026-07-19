/** Session-only “view as” role for superadmin shadowing (not a security boundary). */

export type ViewAsRole = 'student' | 'supervisor';

export const VIEW_AS_STORAGE_KEY = 'phd_view_as_role';
export const VIEW_AS_EVENT = 'phd-view-as-changed';
export const PERMISSIONS_CHANGED_EVENT = 'phd-permissions-changed';

export function notifyPermissionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERMISSIONS_CHANGED_EVENT));
  }
}

export function readViewAsRole(): ViewAsRole | null {
  try {
    const v = sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    if (v === 'student' || v === 'supervisor') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeViewAsRole(role: ViewAsRole | null) {
  try {
    if (role) sessionStorage.setItem(VIEW_AS_STORAGE_KEY, role);
    else sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIEW_AS_EVENT, { detail: { role } }));
  }
}

export function viewAsLabel(role: ViewAsRole | null): string {
  if (role === 'student') return 'Student';
  if (role === 'supervisor') return 'Supervisor';
  return '';
}
