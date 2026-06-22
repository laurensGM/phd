/** Abbreviate recurring thesis terms for compact objective diagrams. */
export function abbreviateObjectiveText(text: string): string {
  return (
    text
      // Longest phrases first
      .replace(/digital agricultural information systems/gi, 'digital agricultural IS')
      .replace(/agricultural information systems/gi, 'agricultural IS')
      .replace(/information systems/gi, 'IS')
      .replace(/information system/gi, 'IS')
      .replace(/task-technology fit/gi, 'TTF')
      .replace(/task technology fit/gi, 'TTF')
      .replace(/continuance intention/gi, 'CI')
      .replace(/perceived usefulness/gi, 'PU')
      .replace(/sub-saharan africa/gi, 'SSA')
      .replace(/\bsatisfaction\b/gi, 'S')
  );
}

export const OBJECTIVE_ABBREVIATION_KEY = [
  { abbr: 'TTF', full: 'task–technology fit' },
  { abbr: 'CI', full: 'continuance intention' },
  { abbr: 'IS', full: 'information systems' },
  { abbr: 'SSA', full: 'Sub-Saharan Africa' },
  { abbr: 'PU', full: 'perceived usefulness' },
  { abbr: 'S', full: 'satisfaction' },
] as const;
