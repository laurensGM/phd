import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export const DEFAULT_PROJECT_ID = 'a0000000-0000-4000-8000-000000000001';

export type ProjectRole = 'owner' | 'student' | 'supervisor';

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export function getAuthRedirectUrl(path = 'login/') {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${base}${path.replace(/^\//, '')}`;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function signInWithMagicLink(email: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: getAuthRedirectUrl('login/'),
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** After login: accept invites, or claim the default project if it is still empty. */
export async function bootstrapProjectAccess(): Promise<{
  memberships: ProjectMember[];
  claimed: boolean;
  accepted: number;
}> {
  if (!supabase || !isSupabaseConfigured()) {
    return { memberships: [], claimed: false, accepted: 0 };
  }

  const { data: accepted, error: acceptErr } = await supabase.rpc('accept_my_project_invites');
  if (acceptErr) throw acceptErr;
  const acceptedRows = (accepted as ProjectMember[] | null) ?? [];

  let { data: memberships, error: memErr } = await supabase
    .from('project_members')
    .select('id, project_id, user_id, role, created_at')
    .order('created_at', { ascending: true });
  if (memErr) throw memErr;

  let claimed = false;
  let list = (memberships as ProjectMember[] | null) ?? [];
  if (!list.length) {
    const { data: claimedRow, error: claimErr } = await supabase.rpc('claim_default_project_if_empty');
    if (claimErr) throw claimErr;
    if (claimedRow) {
      claimed = true;
      list = [claimedRow as ProjectMember];
    }
  }

  return {
    memberships: list,
    claimed,
    accepted: acceptedRows.length,
  };
}

export async function listMyMemberships(): Promise<ProjectMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('project_members')
    .select('id, project_id, user_id, role, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as ProjectMember[]) ?? [];
}
