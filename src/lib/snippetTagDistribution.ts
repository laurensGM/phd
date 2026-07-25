export interface ChartSlice {
  label: string;
  count: number;
  color: string;
}

export const CHART_SLICE_COLORS = [
  '#712038', // maroon
  '#8B704C', // gold dark
  '#9C416B', // maroon muted
  '#5C4A4F', // ink muted
  '#E5C65C', // gold light (fills)
  '#4A1925', // maroon dark
  '#D4AF37', // gold (fills)
  '#E0D6CC', // border / neutral
] as const;

const OTHER_COLOR = '#E0D6CC';

function flattenIds(ids: string[]): string[] {
  return ids.flatMap((id) =>
    id.includes(',') ? id.split(',').map((x) => x.trim()).filter(Boolean) : [id]
  );
}

export function getSnippetConstructIds(row: {
  construct_ids?: string[] | null;
  construct_id?: string | null;
}): string[] {
  const raw = row.construct_ids ?? row.construct_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw);
  if (typeof raw === 'string' && raw) {
    return flattenIds(raw.split(',').map((x) => x.trim()).filter(Boolean));
  }
  return row.construct_id ? flattenIds([row.construct_id]) : [];
}

export function getSnippetModelIds(row: {
  model_ids?: string[] | null;
  model_id?: string | null;
}): string[] {
  const raw = row.model_ids ?? row.model_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw);
  if (typeof raw === 'string' && raw) {
    return flattenIds(raw.split(',').map((x) => x.trim()).filter(Boolean));
  }
  return row.model_id ? flattenIds([row.model_id]) : [];
}

export function countTagAssignments(
  snippets: { id: string }[],
  getIds: (row: (typeof snippets)[number]) => string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const snippet of snippets) {
    for (const id of getIds(snippet)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Constructs/models with exactly one tag go into "Other"; zero-count ids are omitted. */
export function buildChartSlices(
  rawCounts: Map<string, number>,
  labelById: Map<string, string>
): ChartSlice[] {
  const entries = [...rawCounts.entries()].filter(([, count]) => count > 0);
  if (entries.length === 0) return [];

  const singles = entries.filter(([, count]) => count === 1);
  const multiples = entries.filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);

  const slices: ChartSlice[] = multiples.map(([id, count], index) => ({
    label: labelById.get(id) ?? id,
    count,
    color: CHART_SLICE_COLORS[index % CHART_SLICE_COLORS.length],
  }));

  if (singles.length > 0) {
    slices.push({
      label: 'Other',
      count: singles.length,
      color: OTHER_COLOR,
    });
  }

  return slices;
}

export function tagAssignmentTotal(slices: ChartSlice[]): number {
  return slices.reduce((sum, s) => sum + s.count, 0);
}
