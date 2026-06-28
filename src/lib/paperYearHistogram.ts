export interface YearBin {
  year: number;
  count: number;
}

export function parsePublicationYear(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const fourDigit = trimmed.match(/\b(19|20)\d{2}\b/);
  if (fourDigit) return parseInt(fourDigit[0], 10);
  const n = parseInt(trimmed, 10);
  if (!Number.isNaN(n) && n >= 1900 && n <= 2100) return n;
  return null;
}

export function buildYearHistogram(
  yearValues: (string | null | undefined)[]
): { bins: YearBin[]; withoutYear: number } {
  const counts = new Map<number, number>();
  let withoutYear = 0;

  for (const raw of yearValues) {
    const year = parsePublicationYear(raw);
    if (year === null) {
      withoutYear += 1;
      continue;
    }
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return { bins: [], withoutYear };
  }

  const years = [...counts.keys()];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const bins: YearBin[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    bins.push({ year, count: counts.get(year) ?? 0 });
  }

  return { bins, withoutYear };
}

/** Nice step for y-axis ticks (1, 2, 5, 10, …). */
export function yAxisTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [0];
  if (maxCount <= 5) {
    return Array.from({ length: maxCount + 1 }, (_, i) => i);
  }
  const roughStep = Math.ceil(maxCount / 4);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const step =
    normalized <= 1 ? magnitude : normalized <= 2 ? 2 * magnitude : normalized <= 5 ? 5 * magnitude : 10 * magnitude;
  const top = Math.ceil(maxCount / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}
