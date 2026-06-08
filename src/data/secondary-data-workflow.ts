export const searchToLogWorkflow = [
  {
    step: '1. Search',
    action: 'Search',
    record: 'Use predefined institutions, document families and search terms.',
  },
  {
    step: '2. Screen',
    action: 'Screen',
    record: 'Apply inclusion and exclusion tests before saving to the core corpus.',
  },
  {
    step: '3. Save',
    action: 'Save',
    record: 'Archive PDFs; save web pages as HTML/MHTML and print-to-PDF where possible.',
  },
  {
    step: '4. Log',
    action: 'Log',
    record:
      'Record author, year, title, type, URL, access date, scope, tier, focus and decision.',
  },
  {
    step: '5. Version',
    action: 'Version',
    record: 'Note final, draft, consultation, revised edition or live resource status.',
  },
  {
    step: '6. Cite',
    action: 'Cite',
    record: 'Record citation details and archive filename for reproducibility.',
  },
] as const;

export const sourceLogFieldGroups = [
  {
    group: 'Bibliographic and corpus fields',
    fields: [
      'Doc_ID',
      'Organisation / author',
      'Year',
      'Title',
      'Document type',
      'URL / DOI',
      'Date accessed',
      'Geographic scope',
      'Country / region',
      'Corpus tier',
    ],
  },
  {
    group: 'Decision and thematic fields',
    fields: [
      'Inclusion decision',
      'Exclusion code',
      'Version / update status',
      'Infrastructure focus',
      'Financial-service focus',
      'Governance actors named',
      'Relevance note',
      'Key conceptual terms',
      'Citation details',
      'Archive filename',
    ],
  },
  {
    group: 'Version-control fields',
    fields: [
      'Archive format',
      'Notes on redirects or unstable pages',
      'Draft / final status',
      'Companion documents',
      'Search terms used',
      'Reviewer initials',
      'Date screened',
      'Date coded',
      'Memo link',
      'Follow-up needed',
    ],
  },
] as const;

export const suggestedFolders = [
  '00_protocol',
  '01_core_global',
  '02_core_africa',
  '03_supplementary_global',
  '04_supplementary_africa',
  '05_web_archives',
  '06_source_logs',
  '07_coding_exports',
  '08_writing_memos',
] as const;
