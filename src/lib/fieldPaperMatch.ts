import { paperBelongsToField, type FieldJournalEntry } from './journalMatch';

export interface FieldDef {
  id: string;
  name: string;
  journals?: FieldJournalEntry[];
}

export interface PaperForFieldMatch {
  id: string;
  journal: string | null;
  title?: string | null;
}

export function fieldIdsFromJournal(
  journal: string | null | undefined,
  fields: FieldDef[]
): string[] {
  const ids: string[] = [];
  for (const field of fields) {
    if (paperBelongsToField(journal, field.journals ?? [])) {
      ids.push(field.id);
    }
  }
  return ids;
}

export function manualAssignmentsByPaperId(
  rows: { paper_id: string; field_id: string }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.paper_id) ?? [];
    list.push(row.field_id);
    map.set(row.paper_id, list);
  }
  return map;
}

/** Journal match plus explicit assignments (deduplicated). */
export function getPaperFieldIds(
  paper: PaperForFieldMatch,
  fields: FieldDef[],
  manualByPaperId: Map<string, string[]>
): string[] {
  const fromJournal = fieldIdsFromJournal(paper.journal, fields);
  const manual = manualByPaperId.get(paper.id) ?? [];
  return [...new Set([...fromJournal, ...manual])];
}

export function isPaperLinkedToAnyField(
  paper: PaperForFieldMatch,
  fields: FieldDef[],
  manualByPaperId: Map<string, string[]>
): boolean {
  return getPaperFieldIds(paper, fields, manualByPaperId).length > 0;
}

export function countPapersPerField(
  papers: PaperForFieldMatch[],
  fields: FieldDef[],
  manualByPaperId: Map<string, string[]>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const field of fields) counts.set(field.id, 0);

  for (const paper of papers) {
    for (const fieldId of getPaperFieldIds(paper, fields, manualByPaperId)) {
      counts.set(fieldId, (counts.get(fieldId) ?? 0) + 1);
    }
  }
  return counts;
}

export function getUnmatchedPapers(
  papers: PaperForFieldMatch[],
  fields: FieldDef[],
  manualByPaperId: Map<string, string[]>
): PaperForFieldMatch[] {
  return papers.filter((paper) => !isPaperLinkedToAnyField(paper, fields, manualByPaperId));
}
