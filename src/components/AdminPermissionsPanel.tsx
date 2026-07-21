import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ViewAsControls } from './ViewAsBanner';
import { notifyPermissionsChanged } from '../lib/viewAs';

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

/** Navbar sections — one permissions table each. */
const NAV_SECTIONS: { id: string; label: string; hint?: string }[] = [
  { id: 'Literature', label: 'Literature', hint: 'Papers, snippets, claims' },
  { id: 'Writing', label: 'Writing', hint: 'Writing guides and LR workflow' },
  { id: 'Methods', label: 'Methods' },
  { id: 'Research', label: 'Research' },
  { id: 'Tools', label: 'Tools' },
  { id: 'Manager', label: 'Manager', hint: 'Diary, tasks, meeting notes, documents, admin' },
];

function PermissionMatrixTable({
  sectionLabel,
  permissions,
  matrix,
  savingKey,
  onToggle,
}: {
  sectionLabel: string;
  permissions: PermissionDef[];
  matrix: Record<string, MatrixCell>;
  savingKey: string | null;
  onToggle: (permissionKey: string, role: AppRole) => void;
}) {
  if (permissions.length === 0) {
    return (
      <section className="admin-perm-section">
        <h2 className="admin-perm-section-title">{sectionLabel}</h2>
        <p className="admin-muted admin-perm-section-empty">No permissions in this section yet.</p>
      </section>
    );
  }

  return (
    <section className="admin-perm-section">
      <h2 className="admin-perm-section-title">{sectionLabel}</h2>
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
                          onChange={() => onToggle(p.key, role.id)}
                          aria-label={`${sectionLabel} · ${role.label}: ${p.label}`}
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
    </section>
  );
}

export default function AdminPermissionsPanel() {
  const { loading: authLoading, isSignedIn, isRealSuperadmin, isViewingAs, clearViewAs } =
    useAuth();
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
    if (isSignedIn && isRealSuperadmin && !isViewingAs) void load();
  }, [isSignedIn, isRealSuperadmin, isViewingAs, load]);

  const permissionsBySection = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const section of NAV_SECTIONS) {
      map.set(section.id, []);
    }
    for (const p of permissions) {
      const bucket = map.get(p.category);
      if (bucket) {
        bucket.push(p);
      } else {
        // Legacy categories (Admin, Project, etc.) fall under Manager
        const manager = map.get('Manager') ?? [];
        manager.push(p);
        map.set('Manager', manager);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [permissions]);

  const toggle = async (permissionKey: string, role: AppRole) => {
    if (!supabase || !isRealSuperadmin || isViewingAs) return;
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
    notifyPermissionsChanged();
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

  if (isViewingAs) {
    return (
      <p className="admin-banner admin-banner-warn">
        Admin is hidden while view-as is active.{' '}
        <button type="button" className="admin-inline-btn" onClick={() => clearViewAs()}>
          Exit view-as
        </button>{' '}
        to manage permissions.
      </p>
    );
  }

  if (!isRealSuperadmin) {
    return (
      <p className="admin-banner admin-banner-warn">
        Access denied. Only the superadmin can open this panel.
      </p>
    );
  }

  return (
    <div className="admin-permissions">
      <ViewAsControls />

      <p className="admin-lead">
        One table per navbar section. Rows are roles; columns are permissions for that area of the
        app.
      </p>

      {NAV_SECTIONS.map((section) => (
        <PermissionMatrixTable
          key={section.id}
          sectionLabel={section.label}
          permissions={permissionsBySection.get(section.id) ?? []}
          matrix={matrix}
          savingKey={savingKey}
          onToggle={(key, role) => void toggle(key, role)}
        />
      ))}

      <section className="admin-perm-legend">
        <h2>Permission keys</h2>
        {NAV_SECTIONS.map((section) => {
          const items = permissionsBySection.get(section.id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={section.id} className="admin-perm-cat">
              <h3>{section.label}</h3>
              <ul>
                {items.map((p) => (
                  <li key={p.key}>
                    <code>{p.key}</code> — {p.label}
                    {p.description ? <span className="admin-muted"> · {p.description}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {msg && <p className="admin-banner admin-banner-ok">{msg}</p>}
      {err && <p className="admin-banner admin-banner-warn">{err}</p>}
    </div>
  );
}
