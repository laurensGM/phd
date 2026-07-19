import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

type AppRole = 'superadmin' | 'student' | 'supervisor';

type PermissionDef = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

type MatrixCell = Record<AppRole, boolean>;

const ROLES: { id: AppRole; label: string; hint: string }[] = [
  { id: 'superadmin', label: 'Superadmin', hint: 'Full app control' },
  { id: 'student', label: 'Student', hint: 'Owns and edits the PhD workspace' },
  { id: 'supervisor', label: 'Supervisor', hint: 'Reviews and comments' },
];

export default function AdminPermissionsPanel() {
  const { loading: authLoading, isSignedIn, isSuperadmin } = useAuth();
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [matrix, setMatrix] = useState<Record<string, MatrixCell>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const [{ data: perms, error: pErr }, { data: cells, error: cErr }] = await Promise.all([
      supabase
        .from('app_permissions')
        .select('key, label, description, category, sort_order')
        .order('sort_order', { ascending: true }),
      supabase.from('role_permissions').select('role, permission_key, allowed'),
    ]);
    setLoading(false);
    if (pErr || cErr) {
      setErr(pErr?.message ?? cErr?.message ?? 'Could not load permissions');
      return;
    }

    const permRows = (perms as PermissionDef[] | null) ?? [];
    setPermissions(permRows);

    const next: Record<string, MatrixCell> = {};
    for (const p of permRows) {
      next[p.key] = { superadmin: false, student: false, supervisor: false };
    }
    for (const row of (cells as { role: AppRole; permission_key: string; allowed: boolean }[] | null) ?? []) {
      if (!next[row.permission_key]) {
        next[row.permission_key] = { superadmin: false, student: false, supervisor: false };
      }
      next[row.permission_key][row.role] = !!row.allowed;
    }
    setMatrix(next);
  }, []);

  useEffect(() => {
    if (isSignedIn && isSuperadmin) void load();
  }, [isSignedIn, isSuperadmin, load]);

  const categories = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const toggle = async (permissionKey: string, role: AppRole) => {
    if (!supabase || !isSuperadmin) return;
    const prev = matrix[permissionKey]?.[role] ?? false;
    const nextVal = !prev;
    setMatrix((m) => ({
      ...m,
      [permissionKey]: { ...m[permissionKey], [role]: nextVal },
    }));
    setSavingKey(`${role}:${permissionKey}`);
    setMsg(null);
    setErr(null);
    const { error } = await supabase.from('role_permissions').upsert({
      role,
      permission_key: permissionKey,
      allowed: nextVal,
      updated_at: new Date().toISOString(),
    } as never);
    setSavingKey(null);
    if (error) {
      setMatrix((m) => ({
        ...m,
        [permissionKey]: { ...m[permissionKey], [role]: prev },
      }));
      setErr(error.message);
      return;
    }
    setMsg('Saved.');
    window.setTimeout(() => setMsg(null), 1500);
  };

  if (!isSupabaseConfigured()) {
    return <p className="admin-banner admin-banner-warn">Supabase is not configured.</p>;
  }

  if (authLoading || loading) {
    return <p className="admin-muted">Loading permissions…</p>;
  }

  if (!isSignedIn) {
    return (
      <p className="admin-banner admin-banner-warn">
        <a href={`${base}login/`}>Sign in</a> to access the admin panel.
      </p>
    );
  }

  if (!isSuperadmin) {
    return (
      <p className="admin-banner admin-banner-warn">
        This area is only available to superadmins. If you own this PhD project, run migration{' '}
        <code>053_role_permissions_admin.sql</code> and refresh — default-project owners are promoted
        automatically.
      </p>
    );
  }

  return (
    <div className="admin-permissions">
      <p className="admin-lead">
        Rows are roles. Columns are permissions (placeholders for now — toggle freely; enforcement can be
        wired later).
      </p>

      <div className="admin-table-wrap">
        <table className="admin-perm-table">
          <thead>
            <tr>
              <th scope="col" className="admin-perm-sticky">
                Role
              </th>
              {permissions.map((p) => (
                <th key={p.key} scope="col" title={p.description ?? p.label}>
                  <span className="admin-perm-col-label">{p.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role.id}>
                <th scope="row" className="admin-perm-sticky admin-role-cell">
                  <div className="admin-role-name">{role.label}</div>
                  <div className="admin-role-hint">{role.hint}</div>
                </th>
                {permissions.map((p) => {
                  const checked = matrix[p.key]?.[role.id] ?? false;
                  const busy = savingKey === `${role.id}:${p.key}`;
                  return (
                    <td key={`${role.id}-${p.key}`}>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => void toggle(p.key, role.id)}
                          aria-label={`${role.label}: ${p.label}`}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="admin-perm-legend">
        <h2>Permission catalog</h2>
        {categories.map(([category, items]) => (
          <div key={category} className="admin-perm-cat">
            <h3>{category}</h3>
            <ul>
              {items.map((p) => (
                <li key={p.key}>
                  <code>{p.key}</code> — {p.label}
                  {p.description ? <span className="admin-muted"> · {p.description}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {msg && <p className="admin-banner admin-banner-ok">{msg}</p>}
      {err && <p className="admin-banner admin-banner-warn">{err}</p>}
    </div>
  );
}
