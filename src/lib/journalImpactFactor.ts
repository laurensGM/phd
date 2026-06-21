import impactData from '../data/journalImpactFactors.json';
import { journalMatchCandidates } from './journalMatch';

export interface JournalImpactFactorInfo {
  impactFactor: number | null;
  notListed: boolean;
  label?: string;
  releaseYear: number;
  source: string;
}

type ImpactEntry = {
  matchNames: string[];
  impactFactor?: number;
  notListed?: boolean;
  label?: string;
};

const entries = (impactData as { entries: ImpactEntry[]; releaseYear: number; source: string }).entries;
const meta = impactData as { releaseYear: number; source: string };

function normalizeForLookup(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve JCR impact factor for a field journal display name. */
export function getJournalImpactFactor(journalName: string, extraMatchNames: string[] = []): JournalImpactFactorInfo {
  const candidates = journalMatchCandidates(journalName, extraMatchNames).map(normalizeForLookup);

  for (const entry of entries) {
    const entryNames = entry.matchNames.map(normalizeForLookup);
    const hit = candidates.some((candidate) =>
      entryNames.some((entryName) => entryName === candidate || entryName.includes(candidate) || candidate.includes(entryName))
    );
    if (!hit) continue;

    if (entry.notListed) {
      return {
        impactFactor: null,
        notListed: true,
        label: entry.label,
        releaseYear: meta.releaseYear,
        source: meta.source,
      };
    }

    return {
      impactFactor: entry.impactFactor ?? null,
      notListed: false,
      releaseYear: meta.releaseYear,
      source: meta.source,
    };
  }

  return {
    impactFactor: null,
    notListed: true,
    releaseYear: meta.releaseYear,
    source: meta.source,
  };
}

export function formatImpactFactor(info: JournalImpactFactorInfo): string {
  if (info.impactFactor != null) return info.impactFactor.toFixed(1);
  if (info.label) return info.label;
  return 'Not in JCR';
}
