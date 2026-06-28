import {
  buildChartSlices,
  CHART_SLICE_COLORS,
  type ChartSlice,
} from './snippetTagDistribution';
import { countPapersPerField, type FieldDef } from './fieldPaperMatch';

export interface PaperJournalRow {
  id: string;
  journal: string | null;
}

export type { FieldDef };

export function conicGradientFromSlices(slices: ChartSlice[]): string {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total <= 0) return 'conic-gradient(#e5e7eb 0% 100%)';

  const parts: string[] = [];
  let acc = 0;
  for (const slice of slices) {
    const pct = (slice.count / total) * 100;
    parts.push(`${slice.color} ${acc}% ${acc + pct}%`);
    acc += pct;
  }
  return `conic-gradient(${parts.join(', ')})`;
}

export function sliceTotal(slices: ChartSlice[]): number {
  return slices.reduce((sum, s) => sum + s.count, 0);
}

/** Fields with zero papers are omitted; no "Other" grouping (small category set). */
export function buildFieldDistributionSlices(
  papers: PaperJournalRow[],
  fields: FieldDef[],
  manualByPaperId: Map<string, string[]> = new Map()
): ChartSlice[] {
  const counts = countPapersPerField(papers, fields, manualByPaperId);
  const entries = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return entries.map(([id, count], index) => ({
    label: fields.find((f) => f.id === id)?.name ?? id,
    count,
    color: CHART_SLICE_COLORS[index % CHART_SLICE_COLORS.length],
  }));
}

/** Journals with exactly one paper are grouped into Other. */
export function buildJournalDistributionSlices(papers: PaperJournalRow[]): {
  slices: ChartSlice[];
  withoutJournal: number;
} {
  const counts = new Map<string, number>();
  let withoutJournal = 0;

  for (const paper of papers) {
    const journal = paper.journal?.trim();
    if (!journal) {
      withoutJournal += 1;
      continue;
    }
    counts.set(journal, (counts.get(journal) ?? 0) + 1);
  }

  const labelByKey = new Map<string, string>();
  for (const key of counts.keys()) labelByKey.set(key, key);

  return {
    slices: buildChartSlices(counts, labelByKey),
    withoutJournal,
  };
}
