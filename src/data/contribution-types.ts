export const CONTRIBUTION_TYPES = ['theoretical', 'methodological', 'practical'] as const;

export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  theoretical: 'Theoretical',
  methodological: 'Methodological',
  practical: 'Practical',
};

export function isContributionType(value: string | null | undefined): value is ContributionType {
  return CONTRIBUTION_TYPES.includes(value as ContributionType);
}
