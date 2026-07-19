import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { signOut } from '../lib/auth';
import AccessDenied from './AccessDenied';

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string | null;
  display_name: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
};

const base = import.meta.env.BASE_URL || '/';

export default function MembersPage() {
  const { loading, isSignedIn, user, primaryProjectId, role, refreshMemberships } = useAuth();
  const { loading: permLoading, canManageMembers } = usePermissions();
  const canManage = canManageMembers;
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [projectName, setProjectName] = useState('My PhD');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'supervisor' | 'student'>('supervisor');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !primaryProjectId) return;
    setErr(null);
    const [{ data: proj }, { data: mems, error: mErr }, { data: invs, error: iErr }] = await Promise.all([
      supabase.from('projects').select('name').eq('id', primaryProjectId).maybeSingle(),
      supabase
        .from('project_members')
        .select('id, user_id, role, created_at')
        .eq('project_id', primaryProjectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_invites')
        .select('id, email, role, created_at, accepted_at')
        .eq('project_id', primaryProjectId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    if (mErr) {
      setErr(mErr.message);
      return;
    }
    if (iErr) {
      setErr(iErr.message);
      return;
    }
    if (proj && typeof proj === 'object' && 'name' in proj && typeof (proj as { name: unknown }).name === 'string') {
      setProjectName((proj as { name: string }).name);
    }

    const memberRows = (mems as { id: string; user_id: string; role: string; created_at: string }[] | null) ?? [];
    const userIds = memberRows.map((m) => m.user_id);
    const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);
      for (const p of (profiles as { id: string; email: string | null; display_name: string | null }[] | null) ?? []) {
        profileMap.set(p.id, { email: p.email, display_name: p.display_name });
      }
    }
    setMembers(
      memberRows.map((m) => ({
        ...m,
        email: profileMap.get(m.user_id)?.email ?? null,
        display_name: profileMap.get(m.user_id)?.display_name ?? null,
      }))
    );
    setInvites((invs as InviteRow[] | null) ?? []);
  }, [primaryProjectId]);

  useEffect(() => {
    if (isSignedIn && primaryProjectId) void load();
  }, [isSignedIn, primaryProjectId, load]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !primaryProjectId) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const { data, error } = await supabase.rpc('invite_to_project', {
      p_project_id: primaryProjectId,
      p_email: email.trim(),
      p_role: inviteRole,
    } as never);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const status = (data as { status?: string } | null)?.status;
    setMsg(
      status === 'added'
        ? 'User already had an account — added to the project.'
        : `Invite saved for ${email.trim()}. Ask them to open the app and sign in with that email.`
    );
    setEmail('');
    void load();
    void refreshMemberships();
  };

  const onRemoveMember = async (memberId: string, memberUserId: string) => {
    if (!supabase || !canManage) return;
    if (memberUserId === user?.id) {
      setErr('You cannot remove yourself here.');
      return;
    }
    if (!window.confirm('Remove this member from the project?')) return;
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (error) {
      setErr(error.message);
      return;
    }
    void load();
  };

  const onCancelInvite = async (inviteId: string) => {
    if (!supabase || !canManage) return;
    const { error } = await supabase.from('project_invites').delete().eq('id', inviteId);
    if (error) {
      setErr(error.message);
      return;
    }
    void load();
  };

  if (!isSupabaseConfigured()) {
    return <p className="auth-banner auth-banner-warn">Supabase is not configured.</p>;
  }

  if (loading || permLoading) return <p className="auth-muted">Loading…</p>;

  if (!isSignedIn) {
    return (
      <p className="auth-banner auth-banner-warn">
        <a href={`${base}login/`}>Sign in</a> to manage project members.
      </p>
    );
  }

  if (!canManageMembers) {
    return (
      <AccessDenied
        message="Your role cannot manage project members."
        permission="members.manage"
      />
    );
  }

  if (!primaryProjectId) {
    return (
      <p className="auth-banner auth-banner-warn">
        No project membership yet. If you were invited, refresh after signing in. If you are the first
        user, open <a href={`${base}login/`}>Login</a> once to claim the default project.
      </p>
    );
  }

  return (
    <div className="members-page">
      <div className="members-header">
        <div>
          <p className="auth-muted">
            Project: <strong>{projectName}</strong>
            {role ? <> · your role: <strong>{role}</strong></> : null}
          </p>
        </div>
        <button
          type="button"
          className="auth-btn auth-btn-ghost"
          onClick={() => void signOut().then(() => (window.location.href = `${base}login/`))}
        >
          Sign out
        </button>
      </div>

      <section className="members-section">
        <h2>Members</h2>
        <ul className="members-list">
          {members.map((m) => (
            <li key={m.id} className="members-row">
              <div>
                <div className="members-name">
                  {m.display_name || m.email || m.user_id.slice(0, 8)}
                </div>
                <div className="auth-muted">{m.email}</div>
              </div>
              <div className="members-row-actions">
                <span className="members-role">{m.role}</span>
                {canManage && m.user_id !== user?.id && m.role !== 'owner' && (
                  <button type="button" className="auth-btn-text" onClick={() => void onRemoveMember(m.id, m.user_id)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <section className="members-section">
          <h2>Invite supervisor or student</h2>
          <p className="auth-muted">
            They sign in with a magic link using this email. Pending invites appear below until they join.
          </p>
          <form className="auth-form members-invite-form" onSubmit={(e) => void onInvite(e)}>
            <label className="auth-label" htmlFor="invite-email">
              Email
              <input
                id="invite-email"
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@university.ac.za"
                required
              />
            </label>
            <label className="auth-label" htmlFor="invite-role">
              Role
              <select
                id="invite-role"
                className="auth-input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'supervisor' | 'student')}
              >
                <option value="supervisor">Supervisor</option>
                <option value="student">Student</option>
              </select>
            </label>
            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? 'Inviting…' : 'Send invite'}
            </button>
          </form>
          {msg && <p className="auth-banner auth-banner-ok">{msg}</p>}
        </section>
      )}

      {canManage && invites.length > 0 && (
        <section className="members-section">
          <h2>Pending invites</h2>
          <ul className="members-list">
            {invites.map((inv) => (
              <li key={inv.id} className="members-row">
                <div>
                  <div className="members-name">{inv.email}</div>
                  <div className="auth-muted">role: {inv.role}</div>
                </div>
                <button type="button" className="auth-btn-text" onClick={() => void onCancelInvite(inv.id)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!canManage && (
        <p className="auth-muted">Supervisors can view project data; only owners/students can invite.</p>
      )}

      {err && <p className="auth-banner auth-banner-warn">{err}</p>}
    </div>
  );
}
