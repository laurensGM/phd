/** Suggested FAQ labels — users can add others too. */
export const DEFAULT_FAQ_LABELS = ['method', 'theory', 'contribution'] as const;

export type DefaultFaqLabel = (typeof DEFAULT_FAQ_LABELS)[number];

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function parseLabelsInput(
  selectedDefaults: string[],
  extraInput: string,
  knownLabels: string[] = [],
): string[] {
  const existingByLower = [...DEFAULT_FAQ_LABELS, ...knownLabels].reduce<Record<string, string>>(
    (acc, label) => {
      acc[normalizeLabel(label)] = label.trim().toLowerCase();
      return acc;
    },
    {},
  );

  const result: string[] = [];

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normalizeLabel(trimmed);
    const canonical = existingByLower[key] ?? key;
    if (!result.some((x) => normalizeLabel(x) === key)) {
      result.push(canonical);
    }
  };

  for (const label of selectedDefaults) add(label);
  for (const part of extraInput.split(',')) add(part);

  return result;
}

export function labelsInclude(itemLabels: string[], filterLabel: string): boolean {
  const key = normalizeLabel(filterLabel);
  return itemLabels.some((label) => normalizeLabel(label) === key);
}
