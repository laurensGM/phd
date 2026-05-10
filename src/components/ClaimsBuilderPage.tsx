import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import { buildClaimSuggestPrompt, parseClaimOptions } from '../lib/claimAiPrompt';

const RELATIONSHIP_OPTIONS = [
  { value: 'predicts', label: 'Predicts' },
  { value: 'mediates', label: 'Mediates' },
  { value: 'moderates', label: 'Moderates' },
  { value: 'influences', label: 'Influences' },
  { value: 'relates', label: 'Relates' },
  { value: 'associated', label: 'Associated' },
  { value: 'other', label: 'Other' },
] as const;

const ROLE_OPTIONS = [
  { value: 'supporting', label: 'Supporting' },
  { value: 'contradicting', label: 'Contradicting' },
  { value: 'definition', label: 'Definition' },
] as const;

type Snippet = {
  id: string;
  paper_id: string;
  content: string;
  construct_ids: string[];
  snippet_type: string | null;
};

type PaperSummary = { id: string; title: string | null; authors: string | null; year: string | null };

const constructOptions = (constructsData as { id: string; name?: string }[])
  .map((c) => ({ id: c.id, name: c.name || c.id }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

function constructName(id: string): string {
  return constructOptions.find((c) => c.id === id)?.name ?? id;
}

function overlapsConstructs(snippet: Snippet, ids: string[]): boolean {
  const wanted = ids.filter(Boolean);
  const set = new Set((snippet.construct_ids ?? []).filter(Boolean));
  if (wanted.length <= 1) return wanted.some((id) => set.has(id));
  return wanted.every((id) => set.has(id));
}

function snippetMatchesEvidenceFilter(s: Snippet, includeDefinitions: boolean): boolean {
  const t = (s.snippet_type ?? '').toLowerCase().trim();
  if (t === 'theory' || t === 'empirical finding') return true;
  if (includeDefinitions && t === 'definition') return true;
  if (!t) return true;
  return false;
}

export default function ClaimsBuilderPage() {
  const base = import.meta.env.BASE_URL || '/';
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [primaryConstruct, setPrimaryConstruct] = useState('');
  const [relatedConstruct, setRelatedConstruct] = useState('');
  const [relationshipType, setRelationshipType] = useState<string>('predicts');

  const [includeDefinitions, setIncludeDefinitions] = useState(false);
  const [candidates, setCandidates] = useState<Snippet[]>([]);
  const [papersById, setPapersById] = useState<Map<string, PaperSummary>>(new Map());
  const [loadingSnippets, setLoadingSnippets] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pastedAi, setPastedAi] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [claimText, setClaimText] = useState('');
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const snippetById = useMemo(() => {
    const m = new Map<string, Snippet>();
    for (const s of candidates) m.set(s.id, s);
    return m;
  }, [candidates]);

  /** Construct names chosen in step 1 — used to label the snippet filter in step 2. */
  const constructFilterSummary = useMemo(() => {
    return [primaryConstruct, relatedConstruct].filter(Boolean).map((id) => constructName(id));
  }, [primaryConstruct, relatedConstruct]);

  const snippetByIdRef = useRef(snippetById);
  snippetByIdRef.current = snippetById;

  const loadSnippetsForStep2 = useCallback(async () => {
    if (!supabase || !primaryConstruct) return;
    setLoadingSnippets(true);
    setError(null);
    const constructFilter = [primaryConstruct, relatedConstruct].filter(Boolean);
    const { data, error: qErr } = await supabase
      .from('snippets')
      .select('id, paper_id, content, construct_ids, snippet_type')
      .order('created_at', { ascending: false })
      .limit(600);
    setLoadingSnippets(false);
    if (qErr) {
      setError(qErr.message);
      return;
    }
    const all = (data as Snippet[]) ?? [];
    const filtered = all.filter(
      (s) =>
        overlapsConstructs(s, constructFilter) && snippetMatchesEvidenceFilter(s, includeDefinitions)
    );
    setCandidates(filtered);
    const paperIds = [...new Set(filtered.map((s) => s.paper_id))];
    if (paperIds.length) {
      const { data: papers } = await supabase
        .from('saved_papers')
        .select('id, title, authors, year')
        .in('id', paperIds);
      const map = new Map<string, PaperSummary>();
      for (const p of (papers as PaperSummary[]) ?? []) map.set(p.id, p);
      setPapersById(map);
    } else {
      setPapersById(new Map());
    }
    setSelectedIds([]);
  }, [primaryConstruct, relatedConstruct, includeDefinitions]);

  useEffect(() => {
    if (step === 2 && primaryConstruct) void loadSnippetsForStep2();
  }, [step, primaryConstruct, loadSnippetsForStep2]);

  const toggleSnippet = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setRoles((r) => {
          const next = { ...r };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      const s = snippetByIdRef.current.get(id);
      const t = (s?.snippet_type ?? '').toLowerCase();
      const defaultRole = t === 'definition' ? 'definition' : 'supporting';
      setRoles((r) => ({ ...r, [id]: defaultRole }));
      return [...prev, id];
    });
  };

  const buildEvidenceLines = useCallback(() => {
    const lines: string[] = [];
    let n = 0;
    for (const id of selectedIds) {
      const s = snippetById.get(id);
      if (!s) continue;
      n += 1;
      const p = papersById.get(s.paper_id);
      const bits = [`[${n}]`, p?.title ? `Paper: ${p.title}` : null, p?.authors ? `Authors: ${p.authors}` : null]
        .filter(Boolean)
        .join('\n');
      lines.push(`${bits}\nSnippet: ${s.content}`);
    }
    return lines;
  }, [selectedIds, snippetById, papersById]);

  const copySuggestPrompt = async () => {
    const constructLabels = [primaryConstruct, relatedConstruct].filter(Boolean).map(constructName);
    const prompt = buildClaimSuggestPrompt({
      relationshipType: relationshipType,
      constructLabels,
      evidenceLines: buildEvidenceLines(),
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const applyParsedOptions = () => {
    const parsed = parseClaimOptions(pastedAi);
    if (!parsed) {
      setError('Could not find Option A / Option B in the pasted text. Check the format.');
      return;
    }
    setError(null);
    setOptionA(parsed.a);
    setOptionB(parsed.b);
  };

  const saveClaim = async () => {
    if (!supabase || !claimText.trim()) return;
    setSaving(true);
    setError(null);
    const constructs_involved = [...new Set([primaryConstruct, relatedConstruct].filter(Boolean))];
    const ct = claimText.trim();
    const titleFinal =
      title.trim() ||
      (ct.slice(0, 56).trim() + (ct.length > 56 ? '…' : ''));

    const { data: claimRow, error: cErr } = await supabase
      .from('claims')
      .insert({
        title: titleFinal,
        claim_text: claimText.trim(),
        constructs_involved: constructs_involved,
        relationship_type: relationshipType || null,
        confidence_level: confidence,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();

    if (cErr || !claimRow) {
      setError(cErr?.message ?? 'Could not save claim. If this is the first run, apply the claims migration (034).');
      setSaving(false);
      return;
    }
    const claimId = (claimRow as { id: string }).id;

    const linkRows = selectedIds.map((snippet_id) => ({
      claim_id: claimId,
      snippet_id,
      role: roles[snippet_id] || 'supporting',
    }));
    const { error: lErr } = await supabase.from('claim_snippets').insert(linkRows);
    if (lErr) {
      setError(lErr.message);
      setSaving(false);
      return;
    }
    const { error: vErr } = await supabase.from('claim_versions').insert({
      claim_id: claimId,
      version_text: claimText.trim(),
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

  const canNextFrom1 = Boolean(primaryConstruct);
  const nSel = selectedIds.length;
  const canNextFrom2 = nSel >= 5 && nSel <= 15;
  const canNextFrom4 = Boolean(claimText.trim());

  return (
    <div className="claims-page claims-builder">
      <p className="claims-back">
        <a href={`${base}claims/`}>← Claims</a>
      </p>
      <h1>Create claim</h1>
      <p className="claims-intro">
        Guided flow: pick constructs → choose 5–15 snippets → optional AI wording (paste back) → refine → roles →
        save.
      </p>

      <ol className="claims-steps" aria-label="Progress">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
          <li key={s} className={s === step ? 'claims-step-active' : s < step ? 'claims-step-done' : ''}>
            {s}
          </li>
        ))}
      </ol>

      {error && <p className="claims-error">{error}</p>}

      {step === 1 && (
        <section className="claims-panel">
          <h2>Step 1 — Constructs &amp; relationship</h2>
          <label className="claims-field">
            Primary construct
            <select
              className="claims-input"
              value={primaryConstruct}
              onChange={(e) => setPrimaryConstruct(e.target.value)}
              required
            >
              <option value="">— Select —</option>
              {constructOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="claims-field">
            Related construct <span className="claims-optional">(optional)</span>
            <select className="claims-input" value={relatedConstruct} onChange={(e) => setRelatedConstruct(e.target.value)}>
              <option value="">— None —</option>
              {constructOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="claims-field">
            Relationship type
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
          <div className="claims-actions">
            <button type="button" className="claims-btn" disabled={!canNextFrom1} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="claims-panel">
          <h2>Step 2 — Suggested snippets</h2>
          {constructFilterSummary.length > 0 && (
            <div className="claims-filter-banner" role="status">
              <span className="claims-filter-banner-label">Showing only snippets tagged with</span>{' '}
              <strong className="claims-filter-banner-constructs">{constructFilterSummary.join(' · ')}</strong>
              <span className="claims-filter-banner-tail">
                {' '}
                (from step 1). If both constructs are selected, snippets must contain both tags; with one construct, snippets must contain that tag.
              </span>
            </div>
          )}
          <p className="claims-hint">
            Types included: theory, empirical findings, and untyped snippets
            {includeDefinitions ? '; definitions are included' : ''}. Select <strong>5–15</strong> for a focused claim.
            Full snippet text is shown below.
          </p>
          <label className="claims-check">
            <input
              type="checkbox"
              checked={includeDefinitions}
              onChange={(e) => setIncludeDefinitions(e.target.checked)}
            />
            Include definition-type snippets
          </label>
          {loadingSnippets ? (
            <p className="claims-muted">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="claims-muted">
              No matching snippets for{' '}
              <strong>{constructFilterSummary.join(' · ') || 'the selected constructs'}</strong>. Tag snippets with those
              constructs (or adjust step 1).
            </p>
          ) : (
            <ul className="claims-snippet-pick-list">
              {candidates.map((s) => {
                const p = papersById.get(s.paper_id);
                const checked = selectedIds.includes(s.id);
                return (
                  <li key={s.id} className={checked ? 'claims-snippet-pick checked' : 'claims-snippet-pick'}>
                    <label className="claims-snippet-pick-label">
                      <input type="checkbox" checked={checked} onChange={() => toggleSnippet(s.id)} />
                      <span className="claims-snippet-pick-body">
                        <span className="claims-snippet-pick-paper">{p?.title ?? 'Paper'}</span>
                        <span className="claims-snippet-pick-type">{s.snippet_type ?? '—'}</span>
                        <span className="claims-snippet-pick-text">{s.content}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="claims-count">
            Selected: {nSel} {canNextFrom2 ? '✓' : '(need 5–15)'}
          </p>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="claims-btn" disabled={!canNextFrom2} onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="claims-panel">
          <h2>Step 3 — Confirm evidence set</h2>
          <p>You have selected {nSel} snippet{nSel === 1 ? '' : 's'}. Continue to draft wording with an external LLM.</p>
          <ul className="claims-confirm-list">
            {selectedIds.map((id) => {
              const s = snippetById.get(id);
              const p = s ? papersById.get(s.paper_id) : undefined;
              return (
                <li key={id} className="claims-confirm-item">
                  <div className="claims-confirm-paper">{p?.title ?? 'Paper'}</div>
                  <div className="claims-confirm-snippet">{s?.content ?? '—'}</div>
                </li>
              );
            })}
          </ul>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="claims-btn" onClick={() => setStep(4)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="claims-panel">
          <h2>Step 4 — Suggest claim (AI-assisted, external)</h2>
          <p className="claims-hint">
            This app does not call an LLM directly. Copy the prompt into ChatGPT / Jenni / etc., then paste the reply
            below and parse options.
          </p>
          <div className="claims-actions">
            <button type="button" className="claims-btn" onClick={() => void copySuggestPrompt()}>
              {copyFeedback ? 'Copied!' : 'Copy AI prompt'}
            </button>
          </div>
          <label className="claims-field">
            Paste model response
            <textarea
              className="claims-textarea"
              rows={10}
              value={pastedAi}
              onChange={(e) => setPastedAi(e.target.value)}
              placeholder={'Option A: …\nOption B: …'}
            />
          </label>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" className="claims-btn" onClick={applyParsedOptions}>
              Parse options
            </button>
          </div>
          {(optionA || optionB) && (
            <div className="claims-options">
              <button type="button" className="claims-option-card" onClick={() => setClaimText(optionA)}>
                <span className="claims-option-label">Use option A</span>
                <span>{optionA}</span>
              </button>
              {optionB.trim() ? (
                <button type="button" className="claims-option-card" onClick={() => setClaimText(optionB)}>
                  <span className="claims-option-label">Use option B</span>
                  <span>{optionB}</span>
                </button>
              ) : null}
            </div>
          )}
          <div className="claims-actions">
            <button type="button" className="claims-btn" onClick={() => setStep(5)}>
              Next (edit claim)
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="claims-panel">
          <h2>Step 5 — Refine claim (critical)</h2>
          <p className="claims-hint">
            Edit in your own words so the claim is original and accurate. Your suggested options from step 4 stay
            visible here for reference.
          </p>
          {(optionA.trim() || optionB.trim()) && (
            <div className="claims-options">
              {optionA.trim() && (
                <button type="button" className="claims-option-card" onClick={() => setClaimText(optionA)}>
                  <span className="claims-option-label">Option A</span>
                  <span>{optionA}</span>
                </button>
              )}
              {optionB.trim() && (
                <button type="button" className="claims-option-card" onClick={() => setClaimText(optionB)}>
                  <span className="claims-option-label">Option B</span>
                  <span>{optionB}</span>
                </button>
              )}
            </div>
          )}
          <label className="claims-field">
            Claim
            <textarea
              className="claims-textarea"
              rows={5}
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              placeholder="A testable, literature-supported statement…"
            />
          </label>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(4)}>
              Back
            </button>
            <button type="button" className="claims-btn" disabled={!canNextFrom4} onClick={() => setStep(6)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="claims-panel">
          <h2>Step 6 — Snippet roles</h2>
          <p className="claims-hint">Mark how each piece of evidence relates to your claim.</p>
          <table className="claims-role-table">
            <thead>
              <tr>
                <th>Snippet</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {selectedIds.map((id) => {
                const s = snippetById.get(id);
                const p = s ? papersById.get(s.paper_id) : undefined;
                return (
                  <tr key={id}>
                    <td>
                      <div className="claims-role-paper">{p?.title ?? '—'}</div>
                      <div className="claims-role-snippet">{s?.content ?? '—'}</div>
                    </td>
                    <td>
                      <select
                        className="claims-input"
                        value={roles[id] || 'supporting'}
                        onChange={(e) => setRoles((r) => ({ ...r, [id]: e.target.value }))}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(5)}>
              Back
            </button>
            <button type="button" className="claims-btn" onClick={() => setStep(7)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 7 && (
        <section className="claims-panel">
          <h2>Step 7 — Confidence</h2>
          <p className="claims-hint">
            <strong>Low</strong> — few papers. <strong>Medium</strong> — some consistency. <strong>High</strong> —
            strong repeated evidence.
          </p>
          <div className="claims-confidence">
            {(['low', 'medium', 'high'] as const).map((c) => (
              <label key={c} className={confidence === c ? 'claims-confidence-opt active' : 'claims-confidence-opt'}>
                <input type="radio" name="conf" checked={confidence === c} onChange={() => setConfidence(c)} />
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </label>
            ))}
          </div>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(6)}>
              Back
            </button>
            <button type="button" className="claims-btn" onClick={() => setStep(8)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 8 && (
        <section className="claims-panel">
          <h2>Step 8 — Title &amp; save</h2>
          <label className="claims-field">
            Title <span className="claims-optional">(optional — defaults to start of claim)</span>
            <input className="claims-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short label for your list" />
          </label>
          <label className="claims-field">
            Notes <span className="claims-optional">(optional)</span>
            <textarea className="claims-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="claims-actions">
            <button type="button" className="claims-btn claims-btn-ghost" onClick={() => setStep(7)}>
              Back
            </button>
            <button type="button" className="claims-btn claims-btn-primary" disabled={saving || !claimText.trim()} onClick={() => void saveClaim()}>
              {saving ? 'Saving…' : 'Save claim'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
