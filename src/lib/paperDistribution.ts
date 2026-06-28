import { paperBelongsToField, type FieldJournalEntry } from './journalMatch';
import {
  buildChartSlices,
  CHART_SLICE_COLORS,
  type ChartSlice,
} from './snippetTagDistribution';

export interface PaperJournalRow {
  id: string;
  journal: string | null;
}

export interface FieldDef {
  id: string;
  name: string;
  journals?: FieldJournalEntry[];
}

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
  fields: FieldDef[]
): ChartSlice[] {
  const entries: { id: string; count: number }[] = [];

  for (const field of fields) {
    const journals = field.journals ?? [];
    if (!journals.length) continue;
    let count = 0;
    for (const paper of papers) {
      if (paperBelongsToField(paper.journal, journals)) count += 1;
    }
    if (count > 0) entries.push({ id: field.id, count });
  }

  entries.sort((a, b) => b.count - a.count);

  return entries.map(({ id, count }, index) => ({
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
