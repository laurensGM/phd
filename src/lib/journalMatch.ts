function normalizeJournalName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

/** Build name variants used to match free-text journal values on saved papers. */
export function journalMatchCandidates(displayName: string, extra: string[] = []): string[] {
  const set = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) set.add(trimmed);
  };

  add(displayName);

  const beforeEmDash = displayName.split(/\s*[—–]\s*/)[0]?.trim();
  if (beforeEmDash) add(beforeEmDash);

  const withoutParen = displayName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  add(withoutParen);

  if (beforeEmDash) {
    add(beforeEmDash.replace(/\s*\([^)]*\)\s*$/, '').trim());
  }

  const acronymMatch = displayName.match(/\(([^)]+)\)\s*$/);
  if (acronymMatch?.[1]) add(acronymMatch[1].trim());

  for (const name of [...set]) {
    add(name.replace(/&/g, 'and'));
    add(name.replace(/\band\b/gi, '&'));
  }

  extra.forEach(add);
  return [...set];
}

function namesMatch(paperJournal: string, candidate: string): boolean {
  const paper = normalizeJournalName(paperJournal);
  const target = normalizeJournalName(candidate);
  if (!paper || !target) return false;
  if (paper === target) return true;

  const shorter = paper.length <= target.length ? paper : target;
  const longer = paper.length > target.length ? paper : target;
  if (shorter.length < 8) return false;
  return longer.includes(shorter);
}

export function paperMatchesJournal(
  paperJournal: string | null | undefined,
  candidates: string[]
): boolean {
  if (!paperJournal?.trim()) return false;
  return candidates.some((candidate) => namesMatch(paperJournal, candidate));
}
