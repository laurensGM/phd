/** Where in the literature review a claim will be situated. */
export const CLAIM_LR_CHAPTERS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'ci-to-use-is', label: 'CI to use IS' },
  { id: 'theoretical-foundations', label: 'Theoretical foundations' },
  { id: 'antecedents-of-ci', label: 'Antecedents of CI' },
  { id: 'other-secondary-antecedents', label: 'Other secondary antecedents' },
  { id: 'research-gap', label: 'Research gap' },
  { id: 'proposed-model', label: 'Proposed model' },
  { id: 'ssa-context', label: 'SSA context' },
] as const;

export type ClaimLrChapterId = (typeof CLAIM_LR_CHAPTERS)[number]['id'];

const labelById = new Map(CLAIM_LR_CHAPTERS.map((c) => [c.id, c.label]));

export function claimLrChapterLabel(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return labelById.get(id as ClaimLrChapterId) ?? id;
}

export function isClaimLrChapterId(id: string): id is ClaimLrChapterId {
  return labelById.has(id);
}
