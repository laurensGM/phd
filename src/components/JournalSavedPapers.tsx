import React, { useCallback, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { journalMatchCandidates, paperMatchesJournal } from '../lib/journalMatch';

const PAPERS_FETCH_LIMIT = 3000;

interface SavedPaperRow {
  id: string;
  title: string | null;
  authors: string | null;
  year: string | null;
  status: string | null;
  journal: string | null;
}

interface JournalSavedPapersProps {
  journalName: string;
  matchNames?: string[];
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

export default function JournalSavedPapers({
  journalName,
  matchNames = [],
  base,
}: JournalSavedPapersProps) {
  const [expanded, setExpanded] = useState(false);
  const [papers, setPapers] = useState<SavedPaperRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => journalMatchCandidates(journalName, matchNames),
    [journalName, matchNames]
  );

  const fetchPapers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('saved_papers')
      .select('id, title, authors, year, status, journal')
      .not('journal', 'is', null)
      .order('created_at', { ascending: false })
      .limit(PAPERS_FETCH_LIMIT);

    if (fetchError) {
      setError(fetchError.message);
      setPapers([]);
      setLoading(false);
      return;
    }

    const matched = ((data ?? []) as SavedPaperRow[])
      .filter((paper) => paperMatchesJournal(paper.journal, candidates))
      .sort((a, b) => paperLabel(a).localeCompare(paperLabel(b), undefined, { sensitivity: 'base' }));

    setPapers(matched);
    setLoading(false);
  }, [candidates]);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (papers === null) await fetchPapers();
  };

  if (!isSupabaseConfigured()) return null;

  return (
    <div className="journal-saved-papers">
      <button type="button" className="journal-saved-papers-toggle" onClick={handleToggle}>
        {expanded ? 'Hide papers in my library' : 'Show papers in my library'}
      </button>

      {expanded && (
        <div className="journal-saved-papers-panel">
          {loading && <p className="journal-saved-papers-loading">Loading papers…</p>}
          {error && <p className="journal-saved-papers-error">{error}</p>}
          {!loading && !error && papers && papers.length === 0 && (
            <p className="journal-saved-papers-empty">No saved papers linked to this journal yet.</p>
          )}
          {!loading && !error && papers && papers.length > 0 && (
            <ul className="journal-saved-papers-list">
              {papers.map((paper) => {
                const href = `${base}papers/detail/?id=${paper.id}`;
                const status = (paper.status && paper.status.trim()) || 'Not read';
                return (
                  <li key={paper.id} className="journal-saved-papers-item">
                    <span className={statusClassName(status)}>{status}</span>
                    <a href={href} className="journal-saved-papers-link">
                      {paperLabel(paper)}
                    </a>
                    {paper.journal && paper.journal.trim() !== journalName.trim() && (
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
  );
}
