export const PAPER_READING_SECTIONS = [
  { key: 'read_abstract', label: 'Abstract' },
  { key: 'read_introduction', label: 'Introduction' },
  { key: 'read_methodology', label: 'Method' },
  { key: 'read_results_discussion', label: 'Results' },
  { key: 'read_conclusion', label: 'Conclusion' },
  { key: 'read_limitations_recommendations', label: 'Limitations' },
] as const;

export type PaperReadingSectionKey = (typeof PAPER_READING_SECTIONS)[number]['key'];

export type PaperReadingProgress = Record<PaperReadingSectionKey, boolean>;

export const EMPTY_READING_PROGRESS: PaperReadingProgress = {
  read_abstract: false,
  read_introduction: false,
  read_methodology: false,
  read_results_discussion: false,
  read_conclusion: false,
  read_limitations_recommendations: false,
};
