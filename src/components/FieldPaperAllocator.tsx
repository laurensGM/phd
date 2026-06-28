import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { paperDetailUrl } from '../lib/paperDetailUrl';
import {
  getUnmatchedPapers,
  manualAssignmentsByPaperId,
  type FieldDef,
  type PaperForFieldMatch,
} from '../lib/fieldPaperMatch';

interface FieldPaperAllocatorProps {
  fields: FieldDef[];
  base: string;
}

interface PaperRow extends PaperForFieldMatch {
  title: string | null;
}

interface AssignmentRow {
  paper_id: string;
  field_id: string;
}

export default function FieldPaperAllocator({ fields, base }: FieldPaperAllocatorProps) {
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [savingPaperId, setSavingPaperId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftByPaperId, setDraftByPaperId] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [papersRes, assignRes] = await Promise.all([
      supabase
        .from('saved_papers')
        .select('id, title, journal')
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase.from('paper_field_assignments').select('paper_id, field_id'),
    ]);

    if (papersRes.error) {
      setError(papersRes.error.message);
      setPapers([]);
      setAssignments(new Map());
      setLoading(false);
      return;
    }

    if (assignRes.error) {
      if (/paper_field_assignments/i.test(assignRes.error.message)) {
        setError(
          'Run migration 045_paper_field_assignments.sql in Supabase to enable manual field links.'
        );
      } else {
        setError(assignRes.error.message);
      }
      setPapers((papersRes.data ?? []) as PaperRow[]);
      setAssignments(new Map());
      setLoading(false);
      return;
    }

    const paperRows = (papersRes.data ?? []) as PaperRow[];
    const manual = manualAssignmentsByPaperId((assignRes.data ?? []) as AssignmentRow[]);
    setPapers(paperRows);
    setAssignments(manual);
    setDraftByPaperId({});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  const unmatched = useMemo(
    () => getUnmatchedPapers(papers, fields, assignments),
    [papers, fields, assignments]
  );

  const linkedCount = papers.length - unmatched.length;

  const toggleDraftField = (paperId: string, fieldId: string) => {
    setDraftByPaperId((prev) => {
      const current = prev[paperId] ?? [];
      const next = current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId];
      return { ...prev, [paperId]: next };
    });
  };

  const saveAssignment = async (paper: PaperRow) => {
    if (!supabase) return;
    const selected = draftByPaperId[paper.id] ?? [];
    if (selected.length === 0) {
      setError('Pick at least one field before saving.');
      return;
    }

    setSavingPaperId(paper.id);
    setError(null);

    const { error: deleteError } = await supabase
      .from('paper_field_assignments')
      .delete()
      .eq('paper_id', paper.id);

    if (deleteError) {
      setError(deleteError.message);
      setSavingPaperId(null);
      return;
    }

    const { error: insertError } = await supabase.from('paper_field_assignments').insert(
      selected.map((field_id) => ({ paper_id: paper.id, field_id }))
    );

    setSavingPaperId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(paper.id, selected);
      return next;
    });
    setDraftByPaperId((prev) => {
      const next = { ...prev };
      delete next[paper.id];
      return next;
    });
  };

  if (!isSupabaseConfigured()) return null;

  if (loading) {
    return (
      <section className="field-allocator">
        <p className="field-allocator-muted">Loading papers for field allocation…</p>
      </section>
    );
  }

  if (papers.length === 0) return null;

  return (
    <section className="field-allocator">
      <header className="field-allocator-header">
        <h2 className="field-allocator-title">Link papers to fields</h2>
        <p className="field-allocator-intro">
          {linkedCount} of {papers.length} papers linked to a field via journal name or manual assignment.
          {unmatched.length > 0
            ? ` ${unmatched.length} still need a field — pick one or more below.`
            : ' All papers are linked.'}
        </p>
      </header>

      {error && <p className="field-allocator-error">{error}</p>}

      {unmatched.length === 0 ? (
        <p className="field-allocator-success">Every saved paper is linked to at least one field.</p>
      ) : (
        <ul className="field-allocator-list">
          {unmatched.map((paper) => {
            const selected = draftByPaperId[paper.id] ?? [];
            const busy = savingPaperId === paper.id;
            return (
              <li key={paper.id} className="field-allocator-item">
                <div className="field-allocator-paper">
                  <a
                    href={paperDetailUrl(paper.id, base)}
                    className="field-allocator-paper-title"
                  >
                    {paper.title?.trim() || 'Untitled paper'}
                  </a>
                  <p className="field-allocator-paper-journal">
                    {paper.journal?.trim() ? paper.journal : 'No journal recorded'}
                  </p>
                </div>
                <div className="field-allocator-fields">
                  <span className="field-allocator-fields-label">Assign to</span>
                  <div className="field-allocator-chips">
                    {fields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        className={`field-allocator-chip ${selected.includes(field.id) ? 'field-allocator-chip-selected' : ''}`}
                        onClick={() => toggleDraftField(paper.id, field.id)}
                        disabled={busy}
                      >
                        {field.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="field-allocator-save"
                    onClick={() => saveAssignment(paper)}
                    disabled={busy || selected.length === 0}
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {linkedCount > 0 && unmatched.length > 0 && (
        <p className="field-allocator-hint">
          Tip: if a journal name is wrong, edit it on the paper page — automatic field matching uses the journal field.
        </p>
      )}
    </section>
  );
}
