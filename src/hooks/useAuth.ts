import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  bootstrapProjectAccess,
  type ProjectMember,
  type ProjectRole,
} from '../lib/auth';
import {
  readViewAsRole,
  writeViewAsRole,
  VIEW_AS_EVENT,
  type ViewAsRole,
} from '../lib/viewAs';

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  memberships: ProjectMember[];
  primaryProjectId: string | null;
  /** Real project membership role (owner / student / supervisor). */
  role: ProjectRole | null;
  /** True DB superadmin — ignore view-as. */
  isRealSuperadmin: boolean;
  viewAsRole: ViewAsRole | null;
  error: string | null;
  configured: boolean;
};

const initial: AuthState = {
  loading: true,
  session: null,
  user: null,
  memberships: [],
  primaryProjectId: null,
  role: null,
  isRealSuperadmin: false,
  viewAsRole: null,
  error: null,
  configured: isSupabaseConfigured(),
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => ({
    ...initial,
    viewAsRole: typeof window !== 'undefined' ? readViewAsRole() : null,
  }));

  const refreshMemberships = useCallback(async (user: User | null) => {
    if (!user || !supabase) {
      // Do not clear session view-as here — multiple Astro islands each run useAuth,
      // and a transient null session would wipe view-as for the whole page.
      setState((s) => ({
        ...s,
        memberships: [],
        primaryProjectId: null,
        role: null,
        isRealSuperadmin: false,
        viewAsRole: readViewAsRole(),
      }));
      return;
    }
    try {
      const result = await bootstrapProjectAccess();
      const primary = result.memberships[0] ?? null;

      const { data: rpcFlag, error: rpcErr } = await supabase.rpc('is_superadmin');
      let isRealSuperadmin = false;
      if (!rpcErr && typeof rpcFlag === 'boolean') {
        isRealSuperadmin = rpcFlag;
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .maybeSingle();
        isRealSuperadmin = !!(profile as { is_superadmin?: boolean } | null)?.is_superadmin;
      }

      // Only real superadmins may keep a view-as session
      let viewAsRole = readViewAsRole();
      if (!isRealSuperadmin && viewAsRole) {
        writeViewAsRole(null);
        viewAsRole = null;
      }

      setState((s) => ({
        ...s,
        memberships: result.memberships,
        primaryProjectId: primary?.project_id ?? null,
        role: primary?.role ?? null,
        isRealSuperadmin,
        viewAsRole,
        error: null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Could not load project access',
      }));
    }
  }, []);

  const setViewAs = useCallback(
    (role: ViewAsRole | null) => {
      if (role && !state.isRealSuperadmin) return;
      writeViewAsRole(role);
      setState((s) => ({ ...s, viewAsRole: role }));
    },
    [state.isRealSuperadmin]
  );

  const clearViewAs = useCallback(() => {
    writeViewAsRole(null);
    setState((s) => ({ ...s, viewAsRole: null }));
  }, []);

  useEffect(() => {
    const onViewAs = () => {
      setState((s) => ({ ...s, viewAsRole: readViewAsRole() }));
    };
    window.addEventListener(VIEW_AS_EVENT, onViewAs);
    return () => window.removeEventListener(VIEW_AS_EVENT, onViewAs);
  }, []);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured()) {
      setState((s) => ({ ...s, loading: false, configured: false }));
      return;
    }

    let cancelled = false;

    const applySession = (session: Session | null) => {
      if (cancelled) return;
      setState((s) => ({
        ...s,
        loading: false,
        session,
        user: session?.user ?? null,
        configured: true,
      }));
      void refreshMemberships(session?.user ?? null);
    };

    const failSafe = window.setTimeout(() => {
      if (!cancelled) {
        setState((s) => (s.loading ? { ...s, loading: false } : s));
      }
    }, 4000);

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn('getSession failed', error);
          applySession(null);
          return;
        }
        applySession(data.session);
      })
      .catch((err) => {
        console.warn('getSession error', err);
        applySession(null);
      })
      .finally(() => {
        window.clearTimeout(failSafe);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      sub.subscription.unsubscribe();
    };
  }, [refreshMemberships]);

  const isViewingAs = !!state.viewAsRole && state.isRealSuperadmin;
  /** Effective superadmin for UI — false while shadowing another role. */
  const isSuperadmin = state.isRealSuperadmin && !isViewingAs;

  const effectiveRole: ViewAsRole | ProjectRole | null = isViewingAs
    ? state.viewAsRole
    : state.role;

  const canManage = isViewingAs
    ? state.viewAsRole === 'student'
    : state.role === 'owner' || state.role === 'student';

  return {
    ...state,
    isSignedIn: !!state.session,
    isSuperadmin,
    isRealSuperadmin: state.isRealSuperadmin,
    isViewingAs,
    effectiveRole,
    canManage,
    setViewAs,
    clearViewAs,
    refreshMemberships: () => refreshMemberships(state.user),
  };
}
