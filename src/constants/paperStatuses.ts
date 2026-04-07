/** Shared reading-stage labels for saved papers (list, board, detail). */
export const PAPER_STATUSES = [
  { id: 'Not read', label: 'Not read', description: "Haven't read the paper at all.", color: 'status-not-read' },
  { id: '1st reading', label: '1st reading', description: 'Read abstract, introduction and conclusion.', color: 'status-1st' },
  { id: '2nd reading', label: '2nd reading', description: 'Also dove deeper into method, results and discussion.', color: 'status-2nd' },
  { id: 'Read', label: 'Read', description: 'Read all relevant sections.', color: 'status-read' },
  { id: 'Completed', label: 'Completed', description: 'Copied snippets from the article and attached them for later review.', color: 'status-completed' },
  { id: 'Archive', label: 'Archive', description: 'Paper is archived but still kept for reference.', color: 'status-archive' },
] as const;

export type PaperStatusId = (typeof PAPER_STATUSES)[number]['id'];
