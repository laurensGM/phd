import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { paperBelongsToField, type FieldJournalEntry } from '../lib/journalMatch';

const FETCH_LIMIT = 3000;

export interface FieldData {
  id: string;
  name: string;
  category: string;
  description: string;
  journals?: FieldJournalEntry[];
}

export interface FieldSection {
  category: string;
  label: string;
  desc: string;
  fields: FieldData[];
}

interface FieldsGridProps {
  sections: FieldSection[];
  base: string;
}

interface PaperRow {
  id: string;
  journal: string | null;
}

interface SnippetRow {
  id: string;
  paper_id: string;
}

interface FieldCounts {
  papers: number;
  snippets: number;
}

function formatCountLine(papers: number | null, snippets: number | null, loading: boolean): string {
  if (!isSupabaseConfigured()) return '';
  if (loading || papers === null || snippets === null) return 'Loading library counts…';
  const articleLabel = papers === 1 ? 'article' : 'articles';
  const snippetLabel = snippets === 1 ? 'snippet' : 'snippets';
  return `${papers} ${articleLabel} · ${snippets} ${snippetLabel}`;
}

export default function FieldsGrid({ sections, base }: FieldsGridProps) {
  const [papers, setPapers] = useState<PaperRow[] | null>(null);
  const [snippets, setSnippets] = useState<SnippetRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLibraryData = useCallback(async () => {
    if (!supabase || papers !== null) return;
    setLoading(true);
    setError(null);

    const [{ data: paperData, error: paperError }, { data: snippetData, error: snippetError }] =
      await Promise.all([
        supabase.from('saved_papers').select('id, journal').limit(FETCH_LIMIT),
        supabase.from('snippets').select('id, paper_id').limit(FETCH_LIMIT),
      ]);

    if (paperError || snippetError) {
      setError(paperError?.message ?? snippetError?.message ?? 'Failed to load library counts.');
      setPapers([]);
      setSnippets([]);
    } else {
      setPapers((paperData ?? []) as PaperRow[]);
      setSnippets((snippetData ?? []) as SnippetRow[]);
    }
    setLoading(false);
  }, [papers]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchLibraryData();
  }, [fetchLibraryData]);

  const paperJournalById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const paper of papers ?? []) map.set(paper.id, paper.journal);
    return map;
  }, [papers]);

  const countsByFieldId = useMemo(() => {
    const map = new Map<string, FieldCounts>();
    if (!papers || !snippets) return map;

    for (const section of sections) {
      for (const field of section.fields) {
        const journals = field.journals ?? [];
        const matchedPaperIds = new Set<string>();

        for (const paper of papers) {
          if (paperBelongsToField(paper.journal, journals)) {
            matchedPaperIds.add(paper.id);
          }
        }

        let snippetCount = 0;
        for (const snippet of snippets) {
          const journal = paperJournalById.get(snippet.paper_id);
          if (journal && paperBelongsToField(journal, journals)) snippetCount += 1;
        }

        map.set(field.id, { papers: matchedPaperIds.size, snippets: snippetCount });
      }
    }

    return map;
  }, [sections, papers, snippets, paperJournalById]);

  return (
    <>
      {error && <p className="fields-grid-error">{error}</p>}
      {sections.map((section) => (
        <section key={section.category} className={`fields-section fields-section--${section.category}`}>
          <header className="fields-section-header">
            <h2 className="fields-section-title">{section.label}</h2>
            <p className="fields-section-desc">{section.desc}</p>
          </header>

          <div className="fields-grid">
            {section.fields.map((field) => {
              const counts = countsByFieldId.get(field.id);
              const paperCount = papers === null ? null : (counts?.papers ?? 0);
              const snippetCount = snippets === null ? null : (counts?.snippets ?? 0);
              const countLine = formatCountLine(paperCount, snippetCount, loading);

              return (
                <article key={field.id} className={`field-card field-card--${field.category}`}>
                  <span className={`field-category field-category--${field.category}`}>
                    {section.label}
                  </span>
                  <h3>
                    <a href={`${base}fields/${field.id}/`}>{field.name}</a>
                  </h3>
                  {countLine && <p className="field-library-counts">{countLine}</p>}
                  <p className="field-teaser">
                    {field.description.slice(0, 140)}
                    {field.description.length > 140 ? '…' : ''}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
