import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import fieldsData from '../data/fields.json';
import { fieldIdsFromJournal, type FieldDef } from '../lib/fieldPaperMatch';

const ALL_FIELDS: FieldDef[] = (fieldsData as FieldDef[]).slice().sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
);

const fieldNameById = new Map(ALL_FIELDS.map((f) => [f.id, f.name]));

interface FieldAssignmentRow {
  id: string;
  field_id: string;
  paper_id: string;
  created_at: string;
}

interface FieldLinkDisplay {
  fieldId: string;
  fieldName: string;
  viaJournal: boolean;
  assignmentId?: string;
}

interface PaperFieldLinksProps {
  paperId: string;
  paperJournal: string | null;
  base: string;
}

function buildFieldLinks(
  paperJournal: string | null,
  manualRows: FieldAssignmentRow[]
): FieldLinkDisplay[] {
  const journalIds = new Set(fieldIdsFromJournal(paperJournal, ALL_FIELDS));
  const manualByFieldId = new Map(manualRows.map((r) => [r.field_id, r.id]));
  const allIds = new Set([...journalIds, ...manualByFieldId.keys()]);

  return [...allIds]
    .map((fieldId) => ({
      fieldId,
      fieldName: fieldNameById.get(fieldId) ?? fieldId,
      viaJournal: journalIds.has(fieldId),
      assignmentId: manualByFieldId.get(fieldId),
    }))
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName, undefined, { sensitivity: 'base' }));
}

export default function PaperFieldLinks({ paperId, paperJournal, base }: PaperFieldLinksProps) {
  const [manualRows, setManualRows] = useState<FieldAssignmentRow[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldLinks = useMemo(
    () => buildFieldLinks(paperJournal, manualRows),
    [paperJournal, manualRows]
  );

  const manualFieldIds = useMemo(() => new Set(manualRows.map((r) => r.field_id)), [manualRows]);

  const fetchAssignments = useCallback(async () => {
    if (!supabase || !paperId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('paper_field_assignments')
      .select('id, field_id, paper_id, created_at')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: true });
    if (fetchError) {
      if (/paper_field_assignments/i.test(fetchError.message)) {
        setError('Run migration 045_paper_field_assignments.sql in Supabase to enable field links.');
      } else {
        setError(fetchError.message);
      }
      setManualRows([]);
    } else {
      setManualRows((data ?? []) as FieldAssignmentRow[]);
    }
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !paperId) {
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [paperId, fetchAssignments]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !paperId || !selectedFieldId) return;
    if (manualFieldIds.has(selectedFieldId)) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase.from('paper_field_assignments').insert({
      field_id: selectedFieldId,
      paper_id: paperId,
    });
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSelectedFieldId('');
    await fetchAssignments();
  };

  const handleRemove = async (assignmentId: string) => {
    if (!supabase) return;
    setRemovingId(assignmentId);
    setError(null);
    const { error: delError } = await supabase
      .from('paper_field_assignments')
      .delete()
      .eq('id', assignmentId);
    setRemovingId(null);
    if (delError) {
      setError(delError.message);
      return;
    }
    setManualRows((prev) => prev.filter((r) => r.id !== assignmentId));
  };

  if (!isSupabaseConfigured()) {
    return (
      <p className="paper-detail-field-links-setup">
        Configure Supabase to link this paper to fields.
      </p>
    );
  }

  return (
    <div className="paper-detail-field-links">
      {error && <p className="paper-detail-field-links-error">{error}</p>}

      <form className="paper-detail-field-links-form" onSubmit={handleAdd}>
        <label className="paper-detail-field-links-label" htmlFor={`paper-field-select-${paperId}`}>
          Link to a field
        </label>
        <div className="paper-detail-field-links-row">
          <select
            id={`paper-field-select-${paperId}`}
            className="paper-detail-field-links-select"
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value)}
            disabled={loading || adding}
          >
            <option value="">— Select a field —</option>
            {ALL_FIELDS.map((f) => (
              <option key={f.id} value={f.id} disabled={manualFieldIds.has(f.id)}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="paper-detail-field-links-add"
            disabled={!selectedFieldId || adding || manualFieldIds.has(selectedFieldId)}
          >
            {adding ? 'Adding…' : 'Add link'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="paper-detail-field-links-loading">Loading linked fields…</p>
      ) : fieldLinks.length > 0 ? (
        <ul className="paper-detail-field-links-list">
          {fieldLinks.map((link) => (
            <li key={link.fieldId} className="paper-detail-field-links-item">
              <div className="paper-detail-field-links-item-main">
                <a href={`${base}fields/${link.fieldId}/`} className="paper-detail-field-links-name">
                  {link.fieldName}
                </a>
                {link.viaJournal && !link.assignmentId && (
                  <span className="paper-detail-field-links-badge">Journal match</span>
                )}
                {link.viaJournal && link.assignmentId && (
                  <span className="paper-detail-field-links-badge">Journal + manual</span>
                )}
                {!link.viaJournal && link.assignmentId && (
                  <span className="paper-detail-field-links-badge paper-detail-field-links-badge-manual">
                    Manual
                  </span>
                )}
              </div>
              {link.assignmentId && (
                <button
                  type="button"
                  className="paper-detail-field-links-remove"
                  onClick={() => handleRemove(link.assignmentId!)}
                  disabled={removingId === link.assignmentId}
                  title="Remove manual link"
                >
                  {removingId === link.assignmentId ? '…' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="paper-detail-field-links-empty">
          No fields linked yet. Add a manual link above, or set the journal so it matches a field journal list.
        </p>
      )}
    </div>
  );
}
