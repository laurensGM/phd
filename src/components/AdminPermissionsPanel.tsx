import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ViewAsControls } from './ViewAsBanner';
import { notifyPermissionsChanged } from '../lib/viewAs';
import { NAV_PERMISSION_SECTIONS } from '../lib/navPermissions';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from '../lib/permissions';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

type AppRole = 'superadmin' | 'student' | 'supervisor';

type PermissionDef = {
  key: PermissionKey;
  label: string;
  description: string | null;
};

type MatrixCell = Record<AppRole, boolean>;

const ROLES: { id: AppRole; label: string; hint: string }[] = [
  { id: 'superadmin', label: 'Superadmin', hint: 'Full app control' },
  { id: 'student', label: 'Student', hint: 'Owns and edits the PhD workspace' },
  { id: 'supervisor', label: 'Supervisor', hint: 'Reviews and comments' },
];

function PermissionMatrixTable({
  sectionLabel,
  sectionHint,
  permissions,
  matrix,
  savingKey,
  onToggle,
}: {
  sectionLabel: string;
  sectionHint?: string;
  permissions: PermissionDef[];
  matrix: Record<string, MatrixCell>;
  savingKey: string | null;
  onToggle: (permissionKey: PermissionKey, role: AppRole) => void;
}) {
  return (
    <section className="admin-perm-section">
      <h2 className="admin-perm-section-title">{sectionLabel}</h2>
      {sectionHint ? <p className="admin-muted admin-perm-section-hint">{sectionHint}</p> : null}
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
  const [matrix, setMatrix] = useState<Record<string, MatrixCell>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const permissionsBySection = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const section of NAV_PERMISSION_SECTIONS) {
      map.set(
        section.id,
        section.items.map((item) => ({
          key: item.key as PermissionKey,
          label: item.label,
          description: item.description ?? null,
        }))
      );
    }
    return map;
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const { data: cells, error: cErr } = await supabase
      .from('role_permissions')
      .select('role, permission_key, allowed');
    setLoading(false);
    if (cErr) {
      setErr(cErr.message ?? 'Could not load permissions');
      return;
    }

    const next: Record<string, MatrixCell> = {};
    for (const key of PERMISSION_KEYS) {
      next[key] = {
        superadmin: DEFAULT_ROLE_PERMISSIONS.superadmin[key],
        student: DEFAULT_ROLE_PERMISSIONS.student[key],
        supervisor: DEFAULT_ROLE_PERMISSIONS.supervisor[key],
      };
    }
    for (const row of (cells as { role: AppRole; permission_key: string; allowed: boolean }[] | null) ?? []) {
      const key = row.permission_key as PermissionKey;
      if (!next[key]) {
        next[key] = { superadmin: false, student: false, supervisor: false };
      }
      next[key][row.role] = !!row.allowed;
    }
    setMatrix(next);
  }, []);

  useEffect(() => {
    if (isSignedIn && isRealSuperadmin && !isViewingAs) void load();
  }, [isSignedIn, isRealSuperadmin, isViewingAs, load]);

  const toggle = async (permissionKey: PermissionKey, role: AppRole) => {
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
        One table per navbar section. Rows are roles; columns are menu items — tick access for
        each.
      </p>

      {NAV_PERMISSION_SECTIONS.map((section) => (
        <PermissionMatrixTable
          key={section.id}
          sectionLabel={section.label}
          sectionHint={section.hint}
          permissions={permissionsBySection.get(section.id) ?? []}
          matrix={matrix}
          savingKey={savingKey}
          onToggle={(key, role) => void toggle(key, role)}
        />
      ))}

      {msg && <p className="admin-banner admin-banner-ok">{msg}</p>}
      {err && <p className="admin-banner admin-banner-warn">{err}</p>}
    </div>
  );
}
