import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  canEditWithNavAccess,
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
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const userId = auth.user?.id ?? null;

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
    if (!supabase || !isSupabaseConfigured() || !userId) {
      setMatrix(cloneDefaults());
      setFetchedForUserId(null);
      return;
    }

    let cancelled = false;
    // Mark stale until this fetch completes for the current user.
    setFetchedForUserId(null);
    void (async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, permission_key, allowed');
      if (cancelled) return;
      if (error) {
        console.warn('Could not load role_permissions; using defaults', error.message);
        setMatrix(cloneDefaults());
        setFetchedForUserId(userId);
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
      setFetchedForUserId(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

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

  const matrixReady = !userId || fetchedForUserId === userId;

  const can = useCallback(
    (key: PermissionKey): boolean => {
      if (!auth.isSignedIn || !permissionRole) return false;
      return !!matrix[permissionRole]?.[key];
    },
    [auth.isSignedIn, permissionRole, matrix]
  );

  const canViewPapers = can('nav.literature.papers');
  const canViewSnippets = can('nav.literature.snippets');
  const canViewClaims = can('nav.literature.claims');
  const canViewDiary = can('nav.manager.diary');
  const canViewTasks = can('nav.manager.tasks');
  const canViewMeetingNotes = can('nav.manager.meeting_notes');
  const canViewDocuments = can('nav.manager.documents');

  return {
    loading: auth.loading || !matrixReady,
    permissionRole,
    can,
    canViewPapers,
    canEditPapers: canEditWithNavAccess(canViewPapers, permissionRole),
    canViewSnippets,
    canEditSnippets: canEditWithNavAccess(canViewSnippets, permissionRole),
    canViewClaims,
    canEditClaims: canEditWithNavAccess(canViewClaims, permissionRole),
    canViewDiary,
    canEditDiary: canEditWithNavAccess(canViewDiary, permissionRole),
    canViewTasks,
    canEditTasks: canEditWithNavAccess(canViewTasks, permissionRole),
    canViewMeetingNotes,
    canEditMeetingNotes: canEditWithNavAccess(canViewMeetingNotes, permissionRole, {
      supervisorMayEdit: true,
    }),
    canViewDocuments,
    canEditDocuments: canEditWithNavAccess(canViewDocuments, permissionRole),
    canManageMembers: can('nav.manager.members'),
    canAccessAdmin: can('nav.manager.admin'),
  };
}
