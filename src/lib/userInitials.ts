/**
 * Derive 1–2 letter initials for an avatar.
 *
 * - "Laurens Goormachtigha" → "LG" (first + last word)
 * - "goormachtigh.laurens" / email local parts like last.firstname → "LG"
 *   (dotted labels with no spaces are treated as family.given)
 */
export function getUserInitials(opts: {
  email?: string | null;
  displayName?: string | null;
}): string {
  const displayName = (opts.displayName ?? '').trim();
  const email = (opts.email ?? '').trim();
  const emailLocal = email.split('@')[0] ?? '';

  // If display name was auto-copied from the email local part, prefer email rules
  const label =
    displayName && displayName.toLowerCase() !== emailLocal.toLowerCase()
      ? displayName
      : displayName || emailLocal;

  if (!label) return '?';

  const hasWhitespace = /\s/.test(label);
  const tokens = label.split(/[.\-_\s]+/).filter((t) => /[a-zA-Z]/.test(t));

  if (tokens.length >= 2) {
    if (hasWhitespace) {
      // "Laurens Goormachtigha" → L + G
      const first = tokens[0].replace(/[^a-zA-Z]/g, '');
      const last = tokens[tokens.length - 1].replace(/[^a-zA-Z]/g, '');
      if (first && last) return (first[0] + last[0]).toUpperCase();
    }
    // "goormachtigh.laurens" (family.given) → L + G
    const family = tokens[0].replace(/[^a-zA-Z]/g, '');
    const given = tokens[1].replace(/[^a-zA-Z]/g, '');
    if (family && given) return (given[0] + family[0]).toUpperCase();
  }

  if (tokens.length === 1) {
    const letters = tokens[0].replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
    if (letters.length === 1) return letters.toUpperCase();
  }

  const letters = label.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return letters.toUpperCase();
  return '?';
}
