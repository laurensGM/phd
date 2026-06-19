import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { journalMatchCandidates, paperMatchesJournal } from '../lib/journalMatch';
import { paperDetailUrl } from '../lib/paperDetailUrl';

const PAPERS_FETCH_LIMIT = 3000;

export interface FieldJournalItem {
  name: string;
  url?: string;
  note?: string;
  matchNames?: string[];
}

interface SavedPaperRow {
  id: string;
  title: string | null;
  authors: string | null;
  year: string | null;
  status: string | null;
  journal: string | null;
}

interface FieldJournalsSectionProps {
  journals: FieldJournalItem[];
  base: string;
}

function paperLabel(paper: SavedPaperRow): string {
  const title = (paper.title && paper.title.trim()) || 'Untitled paper';
  const meta = [paper.authors?.trim(), paper.year?.trim()].filter(Boolean).join(', ');
  return meta ? `${title} (${meta})` : title;
}

function statusClassName(status: string | null | undefined): string {
  const normalized = (status || 'Not read').trim().toLowerCase().replace(/\s+/g, '-');
  return `journal-saved-paper-status journal-saved-paper-status-${normalized}`;
}

function papersButtonLabel(count: number | null, expanded: boolean): string {
  if (count === null) return 'Show papers in my library';
  const noun = count === 1 ? 'paper' : 'papers';
  return expanded
    ? `Hide ${count} ${noun} in my library`
    : `Show ${count} ${noun} in my library`;
}

export default function FieldJournalsSection({ journals, base }: FieldJournalsSectionProps) {
  const [allPapers, setAllPapers] = useState<SavedPaperRow[] | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());

  const fetchAllPapers = useCallback(async () => {
    if (!supabase || allPapers !== null) return;
    setLoadingPapers(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from('saved_papers')
      .select('id, title, authors, year, status, journal')
      .not('journal', 'is', null)
      .order('created_at', { ascending: false })
      .limit(PAPERS_FETCH_LIMIT);

    if (error) {
      setFetchError(error.message);
      setAllPapers([]);
    } else {
      setAllPapers((data ?? []) as SavedPaperRow[]);
    }
    setLoadingPapers(false);
  }, [allPapers]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchAllPapers();
  }, [fetchAllPapers]);

  const papersByJournal = useMemo(() => {
    const map = new Map<string, SavedPaperRow[]>();
    if (!allPapers) return map;

    for (const journal of journals) {
      const candidates = journalMatchCandidates(journal.name, journal.matchNames ?? []);
      const matched = allPapers
        .filter((paper) => paperMatchesJournal(paper.journal, candidates))
        .sort((a, b) => paperLabel(a).localeCompare(paperLabel(b), undefined, { sensitivity: 'base' }));
      map.set(journal.name, matched);
    }
    return map;
  }, [allPapers, journals]);

  const toggleJournal = (journalName: string) => {
    setExpandedJournals((prev) => {
      const next = new Set(prev);
      if (next.has(journalName)) next.delete(journalName);
      else next.add(journalName);
      return next;
    });
  };

  return (
    <section className="field-journals">
      <h2>Top journals</h2>
      <ul className="journals-list">
        {journals.map((journal) => {
          const matchedPapers = papersByJournal.get(journal.name) ?? [];
          const count = allPapers === null ? null : matchedPapers.length;
          const expanded = expandedJournals.has(journal.name);

          return (
            <li key={journal.name} className="journal-entry">
              <div className="journal-entry-header">
                {journal.url ? (
                  <a
                    href={journal.url}
                    className="journal-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {journal.name}
                    <span className="journal-link-icon" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                ) : (
                  <span className="journal-name">{journal.name}</span>
                )}
              </div>
              {journal.note && <p className="journal-note">{journal.note}</p>}

              {isSupabaseConfigured() && (
                <div className="journal-saved-papers">
                  <button
                    type="button"
                    className="journal-saved-papers-toggle"
                    onClick={() => toggleJournal(journal.name)}
                    disabled={loadingPapers && allPapers === null}
                  >
                    {papersButtonLabel(count, expanded)}
                  </button>

                  {expanded && (
                    <div className="journal-saved-papers-panel">
                      {loadingPapers && allPapers === null && (
                        <p className="journal-saved-papers-loading">Loading papers…</p>
                      )}
                      {fetchError && <p className="journal-saved-papers-error">{fetchError}</p>}
                      {!loadingPapers && !fetchError && matchedPapers.length === 0 && (
                        <p className="journal-saved-papers-empty">
                          No saved papers linked to this journal yet.
                        </p>
                      )}
                      {!fetchError && matchedPapers.length > 0 && (
                        <ul className="journal-saved-papers-list">
                          {matchedPapers.map((paper) => {
                            const href = paperDetailUrl(paper.id, base);
                            const status = (paper.status && paper.status.trim()) || 'Not read';
                            return (
                              <li key={paper.id} className="journal-saved-papers-item">
                                <span className={statusClassName(status)}>{status}</span>
                                <a href={href} className="journal-saved-papers-link">
                                  {paperLabel(paper)}
                                </a>
                                {paper.journal && paper.journal.trim() !== journal.name.trim() && (
                                  <span className="journal-saved-papers-matched-as">
                                    Matched as: {paper.journal.trim()}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
