/** Fields used to build spoken summary text (matches paper_summary display order). */
export interface NarrationSummaryInput {
  abstract?: string | null;
  key_claims?: string | null;
  academic_constructs?: string | null;
  introduction?: string | null;
  methods?: string | null;
  results_and_discussion?: string | null;
  conclusion_section?: string | null;
  limitations_and_future_research?: string | null;
  /** Legacy / AI-generated fields */
  problem?: string | null;
  claims?: string | null;
  method?: string | null;
  results?: string | null;
  discussion?: string | null;
  conclusion?: string | null;
  limitations?: string | null;
  future_research?: string | null;
  results_section?: string | null;
  discussion_section?: string | null;
  limitations_section?: string | null;
  future_research_section?: string | null;
}

export interface NarrationPaperMeta {
  title?: string | null;
  authors?: string | null;
  year?: string | null;
}

function plainText(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  return raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function section(label: string, body: string | null | undefined): string {
  const text = plainText(body);
  if (!text) return '';
  return `${label}. ${text}`;
}

function mergedResults(summary: NarrationSummaryInput): string {
  if (summary.results_and_discussion?.trim()) return summary.results_and_discussion;
  const parts = [summary.results_section, summary.discussion_section, summary.results, summary.discussion]
    .map((p) => plainText(p))
    .filter(Boolean);
  return parts.join(' ');
}

function mergedLimitations(summary: NarrationSummaryInput): string {
  if (summary.limitations_and_future_research?.trim()) return summary.limitations_and_future_research;
  const parts = [
    summary.limitations_section,
    summary.future_research_section,
    summary.limitations,
    summary.future_research,
  ]
    .map((p) => plainText(p))
    .filter(Boolean);
  return parts.join(' ');
}

function mergedConclusion(summary: NarrationSummaryInput): string {
  return summary.conclusion_section?.trim() || summary.conclusion?.trim() || '';
}

/** Build podcast-style narration script from summary sections. */
export function buildNarrationScript(
  summary: NarrationSummaryInput,
  paper: NarrationPaperMeta = {}
): string {
  const title = plainText(paper.title) || 'Untitled paper';
  const authors = plainText(paper.authors);
  const year = plainText(paper.year);
  const byline = [authors, year ? `published ${year}` : ''].filter(Boolean).join(', ');

  const parts: string[] = [
    `Let me walk you through this paper. ${title}.${byline ? ` ${byline}.` : ''}`,
    section('Abstract', summary.abstract || summary.problem),
    section('Key claims', summary.key_claims || summary.claims),
    section('Academic constructs', summary.academic_constructs),
    section('Introduction', summary.introduction),
    section('Methods', summary.methods || summary.method),
    section('Results and discussion', mergedResults(summary)),
    section('Conclusion', mergedConclusion(summary)),
    section('Limitations and future research', mergedLimitations(summary)),
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function hasNarratableSummary(
  summary: NarrationSummaryInput | null | undefined
): boolean {
  if (!summary) return false;
  return buildNarrationScript(summary).length > 80;
}
