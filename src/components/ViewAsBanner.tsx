import { useAuth } from '../hooks/useAuth';
import { viewAsLabel, type ViewAsRole } from '../lib/viewAs';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

/** Site-wide banner while superadmin is shadowing student/supervisor. */
export default function ViewAsBanner() {
  const { isRealSuperadmin, isViewingAs, viewAsRole, clearViewAs, setViewAs } = useAuth();

  if (!isRealSuperadmin) return null;

  if (isViewingAs && viewAsRole) {
    return (
      <div className="view-as-banner" role="status">
        <span>
          Viewing as <strong>{viewAsLabel(viewAsRole)}</strong>
          <span className="view-as-banner-note"> — UI only; exit anytime</span>
        </span>
        <div className="view-as-banner-actions">
          <button
            type="button"
            className="view-as-banner-btn"
            onClick={() => setViewAs(viewAsRole === 'student' ? 'supervisor' : 'student')}
          >
            Switch to {viewAsRole === 'student' ? 'Supervisor' : 'Student'}
          </button>
          <button type="button" className="view-as-banner-btn view-as-banner-btn-exit" onClick={() => clearViewAs()}>
            Exit view-as
          </button>
        </div>
      </div>
    );
  }

  // Not shadowing — no banner on normal pages (controls live in Admin / avatar)
  return null;
}

export function ViewAsControls({ compact = false }: { compact?: boolean }) {
  const { isRealSuperadmin, isViewingAs, viewAsRole, setViewAs, clearViewAs } = useAuth();
  if (!isRealSuperadmin) return null;

  const start = (role: ViewAsRole) => {
    setViewAs(role);
    if (typeof window !== 'undefined' && window.location.pathname.includes('/admin')) {
      window.location.assign(base);
    }
  };

  if (compact) {
    return (
      <div className="view-as-menu-block">
        <div className="view-as-menu-label">View as</div>
        {isViewingAs ? (
          <button type="button" className="nav-profile-menu-item" role="menuitem" onClick={() => clearViewAs()}>
            Exit view-as ({viewAsLabel(viewAsRole)})
          </button>
        ) : (
          <>
            <button type="button" className="nav-profile-menu-item" role="menuitem" onClick={() => start('student')}>
              View as Student
            </button>
            <button
              type="button"
              className="nav-profile-menu-item"
              role="menuitem"
              onClick={() => start('supervisor')}
            >
              View as Supervisor
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="view-as-admin-section">
      <h2>View as (shadow mode)</h2>
      <p className="admin-muted">
        Preview the app as a student or supervisor without logging out. Admin controls hide until you exit.
        This affects the UI in this browser only.
      </p>
      <div className="view-as-admin-actions">
        <button type="button" className="auth-btn" onClick={() => start('student')}>
          View as Student
        </button>
        <button type="button" className="auth-btn" onClick={() => start('supervisor')}>
          View as Supervisor
        </button>
        {isViewingAs && (
          <button type="button" className="auth-btn auth-btn-ghost" onClick={() => clearViewAs()}>
            Exit view-as
          </button>
        )}
      </div>
    </section>
  );
}
