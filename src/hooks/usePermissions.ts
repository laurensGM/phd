import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  resolvePermissionRole,
  type AppPermissionRole,
  type PermissionKey,
} from '../lib/permissions';
import { VIEW_AS_EVENT, PERMISSIONS_CHANGED_EVENT } from '../lib/viewAs';

type Matrix = Record<AppPermissionRole, Record<PermissionKey, boolean>>;

function cloneDefaults(): Matrix {
  return {
    superadmin: { ...DEFAULT_ROLE_PERMISSIONS.superadmin },
    student: { ...DEFAULT_ROLE_PERMISSIONS.student },
    supervisor: { ...DEFAULT_ROLE_PERMISSIONS.supervisor },
  };
}

export function usePermissions() {
  const auth = useAuth();
  const [matrix, setMatrix] = useState<Matrix>(() => cloneDefaults());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onViewAs = () => setTick((t) => t + 1);
    window.addEventListener(VIEW_AS_EVENT, onViewAs);
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, onViewAs);
    return () => {
      window.removeEventListener(VIEW_AS_EVENT, onViewAs);
      window.removeEventListener(PERMISSIONS_CHANGED_EVENT, onViewAs);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured() || !auth.isSignedIn) {
      setMatrix(cloneDefaults());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, permission_key, allowed');
      if (cancelled) return;
      if (error) {
        console.warn('Could not load role_permissions; using defaults', error.message);
        setMatrix(cloneDefaults());
        setLoading(false);
        return;
      }

      const next = cloneDefaults();
      for (const row of (data as { role: string; permission_key: string; allowed: boolean }[] | null) ?? []) {
        const role = row.role as AppPermissionRole;
        const key = row.permission_key as PermissionKey;
        if (role in next && PERMISSION_KEYS.includes(key)) {
          next[role][key] = !!row.allowed;
        }
      }
      setMatrix(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.isSignedIn, tick]);

  const permissionRole = useMemo(
    () =>
      resolvePermissionRole({
        isRealSuperadmin: auth.isRealSuperadmin,
        isViewingAs: auth.isViewingAs,
        viewAsRole: auth.viewAsRole,
        role: auth.role,
      }),
    [auth.isRealSuperadmin, auth.isViewingAs, auth.viewAsRole, auth.role, tick]
  );

  const can = useCallback(
    (key: PermissionKey): boolean => {
      if (!auth.isSignedIn || !permissionRole) return false;
      return !!matrix[permissionRole]?.[key];
    },
    [auth.isSignedIn, permissionRole, matrix]
  );

  return {
    loading: auth.loading || loading,
    permissionRole,
    can,
    canViewPapers: can('papers.view'),
    canEditPapers: can('papers.edit'),
    canViewSnippets: can('snippets.view'),
    canEditSnippets: can('snippets.edit'),
    canViewClaims: can('claims.view'),
    canEditClaims: can('claims.edit'),
    canViewDiary: can('diary.view'),
    canEditDiary: can('diary.edit'),
    canViewTasks: can('tasks.view'),
    canEditTasks: can('tasks.edit'),
    canViewMeetingNotes: can('meeting_notes.view'),
    canEditMeetingNotes: can('meeting_notes.edit'),
    canViewDocuments: can('documents.view'),
    canEditDocuments: can('documents.edit'),
    canManageMembers: can('members.manage'),
    canAccessAdmin: can('admin.access'),
  };
}
