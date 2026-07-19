import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  bootstrapProjectAccess,
  type ProjectMember,
  type ProjectRole,
} from '../lib/auth';

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  memberships: ProjectMember[];
  primaryProjectId: string | null;
  role: ProjectRole | null;
  isSuperadmin: boolean;
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
  isSuperadmin: false,
  error: null,
  configured: isSupabaseConfigured(),
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initial);

  const refreshMemberships = useCallback(async (user: User | null) => {
    if (!user || !supabase) {
      setState((s) => ({
        ...s,
        memberships: [],
        primaryProjectId: null,
        role: null,
        isSuperadmin: false,
      }));
      return;
    }
    try {
      const result = await bootstrapProjectAccess();
      const primary = result.memberships[0] ?? null;

      // Prefer DB RPC so client cannot spoof admin via stale profile cache
      const { data: rpcFlag, error: rpcErr } = await supabase.rpc('is_superadmin');
      let isSuperadmin = false;
      if (!rpcErr && typeof rpcFlag === 'boolean') {
        isSuperadmin = rpcFlag;
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .maybeSingle();
        isSuperadmin = !!(profile as { is_superadmin?: boolean } | null)?.is_superadmin;
      }

      setState((s) => ({
        ...s,
        memberships: result.memberships,
        primaryProjectId: primary?.project_id ?? null,
        role: primary?.role ?? null,
        isSuperadmin,
        error: null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Could not load project access',
      }));
    }
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

  return {
    ...state,
    isSignedIn: !!state.session,
    canManage: state.role === 'owner' || state.role === 'student',
    refreshMemberships: () => refreshMemberships(state.user),
  };
}
