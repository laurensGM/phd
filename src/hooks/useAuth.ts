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
      }));
      return;
    }
    try {
      const result = await bootstrapProjectAccess();
      const primary = result.memberships[0] ?? null;
      setState((s) => ({
        ...s,
        memberships: result.memberships,
        primaryProjectId: primary?.project_id ?? null,
        role: primary?.role ?? null,
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

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data.session;
      setState((s) => ({
        ...s,
        loading: false,
        session,
        user: session?.user ?? null,
        configured: true,
      }));
      void refreshMemberships(session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        loading: false,
        session,
        user: session?.user ?? null,
      }));
      void refreshMemberships(session?.user ?? null);
    });

    return () => {
      cancelled = true;
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
