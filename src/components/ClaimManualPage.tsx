import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import { CLAIM_LR_CHAPTERS } from '../constants/claimLrChapters';
import { usePermissions } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';

const RELATIONSHIP_OPTIONS = [
  { value: 'predicts', label: 'Predicts' },
  { value: 'mediates', label: 'Mediates' },
  { value: 'moderates', label: 'Moderates' },
  { value: 'influences', label: 'Influences' },
  { value: 'relates', label: 'Relates' },
  { value: 'associated', label: 'Associated' },
  { value: 'other', label: 'Other' },
] as const;

const constructOptions = (constructsData as { id: string; name?: string }[])
  .map((c) => ({ id: c.id, name: c.name || c.id }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export default function ClaimManualPage() {
  const base = import.meta.env.BASE_URL || '/';
  const { loading: permLoading, canEditClaims } = usePermissions();
  const [claimText, setClaimText] = useState('');
  const [constructIds, setConstructIds] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState('relates');
  const [lrChapter, setLrChapter] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [constructFilter, setConstructFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredConstructs = constructFilter.trim()
    ? constructOptions.filter((c) =>
        c.name.toLowerCase().includes(constructFilter.trim().toLowerCase())
      )
    : constructOptions;

  const toggleConstruct = (id: string) => {
    setConstructIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const saveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !claimText.trim()) return;
    setSaving(true);
    setError(null);
    const ct = claimText.trim();
    const titleFinal = title.trim() || ct.slice(0, 56).trim() + (ct.length > 56 ? '…' : '');

    const { data: claimRow, error: cErr } = await supabase
      .from('claims')
      .insert({
        title: titleFinal,
        claim_text: ct,
        constructs_involved: constructIds,
        relationship_type: relationshipType || null,
        lr_chapter: lrChapter || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();

    if (cErr || !claimRow) {
      setError(cErr?.message ?? 'Could not save claim.');
      setSaving(false);
      return;
    }

    const claimId = (claimRow as { id: string }).id;
    const { error: vErr } = await supabase.from('claim_versions').insert({
      claim_id: claimId,
      version_text: ct,
    });
    if (vErr) {
      setError(vErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    window.location.href = `${base}claims/detail/?id=${encodeURIComponent(claimId)}`;
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="claims-page">
        <p className="claims-error">Supabase is not configured.</p>
      </div>
    );
  }

  if (permLoading) {
    return (
      <div className="claims-page">
        <p className="claims-muted">Loading…</p>
      </div>
    );
  }

  if (!canEditClaims) {
    return (
      <AccessDenied message="Your role cannot create or edit claims." permission="nav.literature.claims" />
    );
  }

  return (
    <div className="claims-page claims-manual">
      <p className="claims-back">
        <a href={`${base}claims/`}>← Claims</a>
      </p>
      <header className="claims-header">
        <h1>Write a claim</h1>
        <p className="claims-intro">
          Write your claim in your own words, tag constructs if useful, then link snippets on the claim detail page or
          from the Snippets page.
        </p>
        <p className="claims-muted">
          Prefer the guided flow?{' '}
          <a href={`${base}claims/new/`}>Use the claim builder</a>
        </p>
      </header>

      <form className="claims-panel" onSubmit={(e) => void saveClaim(e)}>
        <h2>Claim text</h2>
        <label className="claims-field">
          Your claim <span className="claims-optional">(required)</span>
          <textarea
            className="claims-textarea"
            rows={6}
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            placeholder="e.g. Perceived usefulness positively predicts continuance intention in mobile banking contexts."
            required
          />
        </label>

        <label className="claims-field">
          Title <span className="claims-optional">(optional — auto-generated from claim text)</span>
          <input
            className="claims-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short label for lists"
          />
        </label>

        <div className="claims-field">
          Constructs <span className="claims-optional">(optional)</span>
          <input
            className="claims-input"
            type="search"
            value={constructFilter}
            onChange={(e) => setConstructFilter(e.target.value)}
            placeholder="Filter constructs…"
          />
          <div className="claims-construct-chips">
            {filteredConstructs.slice(0, 80).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`claims-construct-chip${constructIds.includes(c.id) ? ' selected' : ''}`}
                onClick={() => toggleConstruct(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {constructIds.length > 0 && (
            <p className="claims-muted">
              Selected: {constructIds.map((id) => constructOptions.find((c) => c.id === id)?.name ?? id).join(', ')}
            </p>
          )}
        </div>

        <label className="claims-field">
          Relationship type <span className="claims-optional">(optional)</span>
          <select
            className="claims-input"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
          >
            {RELATIONSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="claims-field">
          LR chapter <span className="claims-optional">(optional)</span>
          <select
            className="claims-input"
            value={lrChapter}
            onChange={(e) => setLrChapter(e.target.value)}
          >
            <option value="">— Not set —</option>
            {CLAIM_LR_CHAPTERS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="claims-field">
          Notes <span className="claims-optional">(optional)</span>
          <textarea
            className="claims-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Rationale, scope, or caveats"
          />
        </label>

        {error && <p className="claims-error">{error}</p>}

        <div className="claims-actions">
          <button type="submit" className="claims-btn claims-btn-primary" disabled={saving || !claimText.trim()}>
            {saving ? 'Saving…' : 'Save claim'}
          </button>
          <a className="claims-btn claims-btn-ghost" href={`${base}claims/`}>
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
