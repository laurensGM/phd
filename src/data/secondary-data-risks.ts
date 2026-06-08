export const documentaryRisks = [
  {
    risk: 'Formal institutional discourse',
    whyItMatters:
      'Official texts show priorities and framings, not necessarily implementation realities.',
    mitigation:
      'Describe the study as analysis of governing discourse and institutional design.',
  },
  {
    risk: 'Version instability',
    whyItMatters:
      'Living guides, drafts and consultation papers can change while analysis is underway.',
    mitigation: 'Freeze corpus; log versions; keep a 2026 update file.',
  },
  {
    risk: 'Cross-country comparability',
    whyItMatters: 'Countries publish different document types and levels of detail.',
    mitigation: 'Compare policy functions rather than identical document genres.',
  },
  {
    risk: 'Hidden power and silences',
    whyItMatters: 'Platforms or market actors may shape outcomes outside formal documents.',
    mitigation: 'Code for silences, assumptions, actor roles and value capture.',
  },
  {
    risk: 'Language/publication bias',
    whyItMatters: 'English and well-documented jurisdictions may dominate.',
    mitigation:
      'Use a supplementary contextual file without expanding the core endlessly.',
  },
] as const;
