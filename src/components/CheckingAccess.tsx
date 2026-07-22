/** Neutral loading state while auth / permissions resolve — never show Access Denied yet. */
export default function CheckingAccess({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="access-checking" role="status" aria-live="polite" aria-label={label}>
      <span className="access-checking-spinner" aria-hidden="true" />
      <p className="access-checking-label">{label}</p>
    </div>
  );
}
