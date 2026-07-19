import type { PermissionKey } from '../lib/permissions';

const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

export default function AccessDenied({
  title = 'Access denied',
  message = 'Your role does not have permission to view this page.',
  permission,
}: {
  title?: string;
  message?: string;
  permission?: PermissionKey;
}) {
  return (
    <div className="access-denied" role="alert">
      <h2 className="access-denied-title">{title}</h2>
      <p className="access-denied-msg">{message}</p>
      {permission && (
        <p className="access-denied-key">
          Required permission: <code>{permission}</code>
        </p>
      )}
      <p>
        <a className="auth-link" href={base}>
          Back to home
        </a>
      </p>
    </div>
  );
}
