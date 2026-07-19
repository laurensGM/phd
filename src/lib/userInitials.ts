/** Derive 1–2 letter initials for an avatar (e.g. "Laurens Goormachtigha" → "LG"). */
export function getUserInitials(opts: {
  email?: string | null;
  displayName?: string | null;
}): string {
  const name = (opts.displayName ?? '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    if (parts[0].length === 1) return parts[0].toUpperCase();
  }

  const email = (opts.email ?? '').trim();
  const local = email.split('@')[0] ?? '';
  const tokens = local.split(/[.\-_]+/).filter((t) => /[a-zA-Z]/.test(t));
  if (tokens.length >= 2) {
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
  }
  const letters = local.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return letters.toUpperCase();
  return '?';
}
