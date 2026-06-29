import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import { buildParagraphFromClaimPrompt } from '../lib/claimAiPrompt';
import { CLAIM_LR_CHAPTERS, claimLrChapterLabel } from '../constants/claimLrChapters';

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

const ROLE_OPTIONS = [
  { value: 'supporting', label: 'Supporting' },
  { value: 'contradicting', label: 'Contradicting' },
  { value: 'definition', label: 'Definition' },
] as const;

type Claim = {
  id: string;
  title: string;
  claim_text: string;
  constructs_involved: string[];
  relationship_type: string | null;
  lr_chapter: string | null;
  notes: string | null;
  created_at: string;
};

type LinkRow = { id: string; snippet_id: string; role: string };

type Snippet = {
  id: string;
  paper_id: string;
  content: string;
  snippet_type: string | null;
  construct_ids: string[];
};

type Paper = { id: string; title: string | null; authors: string | null; year: string | null; journal: string | null };

const constructNameById = new Map(
  (constructsData as { id: string; name?: string }[]).map((c) => [c.id, c.name || c.id])
);

function getClaimId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('id');
}

function defaultRoleForSnippet(snippet: Snippet): string {
  const t = (snippet.snippet_type ?? '').toLowerCase().trim();
  if (t === 'definition') return 'definition';
  return 'supporting';
}

export default function ClaimDetailPage() {
  const base = import.meta.env.BASE_URL || '/';
  const [claim, setClaim] = useState<Claim | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [snippets, setSnippets] = useState<Map<string, Snippet>>(new Map());
  const [papers, setPapers] = useState<Map<string, Paper>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const [showAddSnippets, setShowAddSnippets] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [candidateSnippets, setCandidateSnippets] = useState<Snippet[]>([]);
  const [candidatePapers, setCandidatePapers] = useState<Map<string, Paper>>(new Map());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [linkingSnippetId, setLinkingSnippetId] = useState<string | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);
  const [updatingLinkId, setUpdatingLinkId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editClaimText, setEditClaimText] = useState('');
  const [editConstructIds, setEditConstructIds] = useState<string[]>([]);
  const [editRelationshipType, setEditRelationshipType] = useState('');
  const [editLrChapter, setEditLrChapter] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editConstructFilter, setEditConstructFilter] = useState('');

  const linkedSnippetIds = useMemo(() => new Set(links.map((l) => l.snippet_id)), [links]);

  const load = useCallback(async () => {
    const id = getClaimId();
    if (!supabase || !isSupabaseConfigured() || !id) {
      setLoading(false);
      setError(!id ? 'Missing claim id in URL. Use ?id=' : null);
      return;
    }
    setError(null);
    const { data: c, error: cErr } = await supabase.from('claims').select('*').eq('id', id).maybeSingle();
    if (cErr || !c) {
      setError(cErr?.message ?? 'Claim not found.');
      setLoading(false);
      return;
    }
    setClaim(c as Claim);

    const { data: ls, error: lErr } = await supabase.from('claim_snippets').select('id, snippet_id, role').eq('claim_id', id);
    if (lErr) {
      setError(lErr.message);
      setLoading(false);
      return;
    }
    const linkRows = (ls as LinkRow[]) ?? [];
    setLinks(linkRows);
    const sids = linkRows.map((l) => l.snippet_id);
    if (sids.length) {
      const { data: sn } = await supabase.from('snippets').select('id, paper_id, content, snippet_type, construct_ids').in('id', sids);
      const sm = new Map<string, Snippet>();
      for (const s of (sn as Snippet[]) ?? []) sm.set(s.id, s);
      setSnippets(sm);
      const pids = [...new Set((sn as Snippet[]).map((x) => x.paper_id))];
      const { data: ps } = await supabase.from('saved_papers').select('id, title, authors, year, journal').in('id', pids);
      const pm = new Map<string, Paper>();
      for (const p of (ps as Paper[]) ?? []) pm.set(p.id, p);
      setPapers(pm);
    } else {
      setSnippets(new Map());
      setPapers(new Map());
    }
    setLoading(false);
  }, []);

  const loadCandidateSnippets = useCallback(async () => {
    if (!supabase || !claim) return;
    setLoadingCandidates(true);
    const { data, error: qErr } = await supabase
      .from('snippets')
      .select('id, paper_id, content, snippet_type, construct_ids')
      .order('created_at', { ascending: false })
      .limit(500);
    if (qErr) {
      setError(qErr.message);
      setLoadingCandidates(false);
      return;
    }
    const all = (data as Snippet[]) ?? [];
    const constructIds = claim.constructs_involved ?? [];
    const filtered =
      constructIds.length > 0
        ? all.filter((s) => {
            const set = new Set((s.construct_ids ?? []).filter(Boolean));
            return constructIds.some((id) => set.has(id));
          })
        : all;
    setCandidateSnippets(filtered);
    const paperIds = [...new Set(filtered.map((s) => s.paper_id))];
    if (paperIds.length) {
      const { data: ps } = await supabase
        .from('saved_papers')
        .select('id, title, authors, year, journal')
        .in('id', paperIds);
      const pm = new Map<string, Paper>();
      for (const p of (ps as Paper[]) ?? []) pm.set(p.id, p);
      setCandidatePapers(pm);
    } else {
      setCandidatePapers(new Map());
    }
    setLoadingCandidates(false);
  }, [claim]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (showAddSnippets && claim) void loadCandidateSnippets();
  }, [showAddSnippets, claim, loadCandidateSnippets]);

  const filteredCandidates = useMemo(() => {
    const q = snippetSearch.trim().toLowerCase();
    return candidateSnippets
      .filter((s) => !linkedSnippetIds.has(s.id))
      .filter((s) => {
        if (!q) return true;
        const p = candidatePapers.get(s.paper_id);
        const hay = [s.content, p?.title, p?.authors, p?.journal].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [candidateSnippets, candidatePapers, linkedSnippetIds, snippetSearch]);

  const addSnippetLink = async (snippet: Snippet) => {
    if (!supabase || !claim || linkedSnippetIds.has(snippet.id)) return;
    setLinkingSnippetId(snippet.id);
    setError(null);
    const role = defaultRoleForSnippet(snippet);
    const { data, error: insErr } = await supabase
      .from('claim_snippets')
      .insert({ claim_id: claim.id, snippet_id: snippet.id, role })
      .select('id, snippet_id, role')
      .single();
    setLinkingSnippetId(null);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    const row = data as LinkRow;
    setLinks((prev) => [...prev, row]);
    setSnippets((prev) => new Map(prev).set(snippet.id, snippet));
    if (!papers.has(snippet.paper_id)) {
      const { data: ps } = await supabase
        .from('saved_papers')
        .select('id, title, authors, year, journal')
        .eq('id', snippet.paper_id)
        .maybeSingle();
      if (ps) setPapers((prev) => new Map(prev).set(snippet.paper_id, ps as Paper));
    }
  };

  const updateLinkRole = async (linkId: string, role: string) => {
    if (!supabase) return;
    setUpdatingLinkId(linkId);
    setError(null);
    const { error: upErr } = await supabase.from('claim_snippets').update({ role }).eq('id', linkId);
    setUpdatingLinkId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, role } : l)));
  };

  const removeLink = async (linkId: string) => {
    if (!supabase) return;
    setRemovingLinkId(linkId);
    setError(null);
    const { error: delErr } = await supabase.from('claim_snippets').delete().eq('id', linkId);
    setRemovingLinkId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  const startEdit = () => {
    if (!claim) return;
    setEditTitle(claim.title);
    setEditClaimText(claim.claim_text);
    setEditConstructIds([...(claim.constructs_involved ?? [])]);
    setEditRelationshipType(claim.relationship_type ?? 'relates');
    setEditLrChapter(claim.lr_chapter ?? '');
    setEditNotes(claim.notes ?? '');
    setEditConstructFilter('');
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const toggleEditConstruct = (id: string) => {
    setEditConstructIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const saveEdit = async () => {
    if (!supabase || !claim || !editClaimText.trim()) return;
    setSavingEdit(true);
    setError(null);
    const trimmedText = editClaimText.trim();
    const textChanged = trimmedText !== claim.claim_text.trim();
    const { data, error: upErr } = await supabase
      .from('claims')
      .update({
        title: editTitle.trim() || claim.title,
        claim_text: trimmedText,
        constructs_involved: editConstructIds,
        relationship_type: editRelationshipType || null,
        lr_chapter: editLrChapter || null,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.id)
      .select('*')
      .single();
    if (upErr || !data) {
      setError(upErr?.message ?? 'Could not save changes.');
      setSavingEdit(false);
      return;
    }
    if (textChanged) {
      await supabase.from('claim_versions').insert({
        claim_id: claim.id,
        version_text: trimmedText,
      });
    }
    setClaim(data as Claim);
    setEditing(false);
    setSavingEdit(false);
  };

  const filteredEditConstructs = editConstructFilter.trim()
    ? constructOptions.filter((c) =>
        c.name.toLowerCase().includes(editConstructFilter.trim().toLowerCase())
      )
    : constructOptions;

  const evidenceLines = useCallback(() => {
    if (!claim) return [];
    const lines: string[] = [];
    let n = 0;
    for (const l of links) {
      const s = snippets.get(l.snippet_id);
      if (!s) continue;
      n += 1;
      const p = papers.get(s.paper_id);
      const header = [p?.title ? `Paper: ${p.title}` : null, p?.authors ? `Authors: ${p.authors}` : null, p?.year ? `Year: ${p.year}` : null]
        .filter(Boolean)
        .join(' · ');
      lines.push(`[${n}] ${header}\nRole: ${l.role}\n${s.content}`);
    }
    return lines;
  }, [claim, links, snippets, papers]);

  const copyParagraphPrompt = async () => {
    if (!claim) return;
    const t = buildParagraphFromClaimPrompt(claim.claim_text, evidenceLines());
    try {
      await navigator.clipboard.writeText(t);
      setCopyMsg('Paragraph prompt copied.');
      window.setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg('Could not copy.');
    }
  };

  const exportCitations = () => {
    if (!claim) return;
    const lines: string[] = [`Claim: ${claim.claim_text}`, '', 'Evidence:', ''];
    for (const l of links) {
      const s = snippets.get(l.snippet_id);
      const p = s ? papers.get(s.paper_id) : undefined;
      const auth = p?.authors?.trim() || 'n.d.';
      const yr = p?.year?.trim() || 'n.d.';
      const ttl = p?.title?.trim() || 'Untitled';
      lines.push(`- [${l.role}] ${auth} (${yr}). ${ttl}.`);
      lines.push(`  Excerpt: ${s?.content?.slice(0, 280) ?? ''}${s && s.content.length > 280 ? '…' : ''}`);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `claim-${claim.id.slice(0, 8)}-export.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deleteClaim = async () => {
    if (!supabase || !claim) return;
    if (!window.confirm('Delete this claim and all linked evidence rows?')) return;
    const { error: dErr } = await supabase.from('claims').delete().eq('id', claim.id);
    if (dErr) setError(dErr.message);
    else window.location.href = `${base}claims/`;
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="claims-page">
        <p className="claims-error">Supabase is not configured.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="claims-page">
        <p className="claims-muted">Loading…</p>
      </div>
    );
  }

  if (error && !claim) {
    return (
      <div className="claims-page">
        <p className="claims-back">
          <a href={`${base}claims/`}>← Claims</a>
        </p>
        <p className="claims-error">{error ?? 'Not found.'}</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="claims-page">
        <p className="claims-back">
          <a href={`${base}claims/`}>← Claims</a>
        </p>
        <p className="claims-error">Not found.</p>
      </div>
    );
  }

  const supporting = links.filter((l) => l.role === 'supporting');
  const contradicting = links.filter((l) => l.role === 'contradicting');
  const definitions = links.filter((l) => l.role === 'definition');

  return (
    <div className="claims-page claims-detail">
      <p className="claims-back">
        <a href={`${base}claims/`}>← Claims</a>
      </p>
      <header className="claims-detail-head">
        <div className="claims-detail-section-head">
          <h1>{claim.title.trim() || 'Claim'}</h1>
          {!editing && (
            <button type="button" className="claims-btn" onClick={startEdit}>
              Edit claim
            </button>
          )}
        </div>
        <p className="claims-detail-meta">
          {claimLrChapterLabel(claim.lr_chapter) && (
            <span className="claims-badge claims-badge-lr">{claimLrChapterLabel(claim.lr_chapter)}</span>
          )}
          {claim.relationship_type && <span className="claims-pill">{claim.relationship_type}</span>}
          <time dateTime={claim.created_at}>{new Date(claim.created_at).toLocaleString()}</time>
        </p>
      </header>

      {error && <p className="claims-error">{error}</p>}

      {editing ? (
        <section className="claims-panel claims-edit-panel">
          <h2>Edit claim</h2>
          <label className="claims-field">
            Title
            <input className="claims-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </label>
          <label className="claims-field">
            Claim text
            <textarea
              className="claims-textarea"
              rows={6}
              value={editClaimText}
              onChange={(e) => setEditClaimText(e.target.value)}
              required
            />
          </label>
          <div className="claims-field">
            Constructs
            <input
              className="claims-input"
              type="search"
              value={editConstructFilter}
              onChange={(e) => setEditConstructFilter(e.target.value)}
              placeholder="Filter constructs…"
            />
            <div className="claims-construct-chips">
              {filteredEditConstructs.slice(0, 80).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`claims-construct-chip${editConstructIds.includes(c.id) ? ' selected' : ''}`}
                  onClick={() => toggleEditConstruct(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <label className="claims-field">
            Relationship type
            <select
              className="claims-input"
              value={editRelationshipType}
              onChange={(e) => setEditRelationshipType(e.target.value)}
            >
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="claims-field">
            LR chapter
            <select
              className="claims-input"
              value={editLrChapter}
              onChange={(e) => setEditLrChapter(e.target.value)}
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
            Notes
            <textarea
              className="claims-textarea"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </label>
          <div className="claims-actions">
            <button
              type="button"
              className="claims-btn claims-btn-primary"
              disabled={savingEdit || !editClaimText.trim()}
              onClick={() => void saveEdit()}
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="claims-btn claims-btn-ghost" disabled={savingEdit} onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <>
      <section className="claims-detail-section">
        <h2>Claim</h2>
        <blockquote className="claims-detail-claim">{claim.claim_text}</blockquote>
      </section>

      {(claim.constructs_involved ?? []).length > 0 && (
        <section className="claims-detail-section">
          <h2>Constructs</h2>
          <ul className="claims-tag-list">
            {(claim.constructs_involved ?? []).map((id) => (
              <li key={id} className="claims-pill">
                {constructNameById.get(id) ?? id}
              </li>
            ))}
          </ul>
        </section>
      )}

      {claim.notes && (
        <section className="claims-detail-section">
          <h2>Notes</h2>
          <p className="claims-notes">{claim.notes}</p>
        </section>
      )}
        </>
      )}

      <section className="claims-detail-section">
        <div className="claims-detail-section-head">
          <h2>Linked snippets</h2>
          <button
            type="button"
            className="claims-btn claims-btn-primary"
            onClick={() => setShowAddSnippets((v) => !v)}
          >
            {showAddSnippets ? 'Hide snippet picker' : 'Add snippets'}
          </button>
        </div>
        <p className="claims-muted">
          Supporting: {supporting.length} · Contradicting: {contradicting.length} · Definition: {definitions.length}
        </p>

        {showAddSnippets && (
          <div className="claims-add-snippets">
            <p className="claims-hint">
              {claim.constructs_involved?.length
                ? 'Showing snippets tagged with this claim’s constructs. Use search to narrow further.'
                : 'Showing recent snippets. Use Edit claim to tag constructs, or search below.'}
            </p>
            <input
              className="claims-input"
              type="search"
              value={snippetSearch}
              onChange={(e) => setSnippetSearch(e.target.value)}
              placeholder="Search snippet text or paper…"
            />
            {loadingCandidates ? (
              <p className="claims-muted">Loading snippets…</p>
            ) : filteredCandidates.length === 0 ? (
              <p className="claims-muted">No snippets available to link.</p>
            ) : (
              <ul className="claims-snippet-pick-list">
                {filteredCandidates.map((s) => {
                  const p = candidatePapers.get(s.paper_id);
                  const busy = linkingSnippetId === s.id;
                  return (
                    <li key={s.id} className="claims-snippet-pick">
                      <div className="claims-snippet-pick-body">
                        <div className="claims-snippet-pick-paper">{p?.title ?? 'Paper'}</div>
                        {s.snippet_type && (
                          <div className="claims-snippet-pick-type">{s.snippet_type}</div>
                        )}
                        <div className="claims-snippet-pick-text">{s.content}</div>
                      </div>
                      <button
                        type="button"
                        className="claims-btn claims-btn-primary claims-add-snippet-btn"
                        disabled={busy}
                        onClick={() => void addSnippetLink(s)}
                      >
                        {busy ? '…' : 'Link'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {links.length === 0 ? (
          <p className="claims-muted">No snippets linked yet. Add some above or link from the Snippets page.</p>
        ) : (
          <ul className="claims-evidence-list">
            {links.map((l) => {
              const s = snippets.get(l.snippet_id);
              const p = s ? papers.get(s.paper_id) : undefined;
              return (
                <li key={l.id} className="claims-evidence-card">
                  <div className="claims-evidence-card-head">
                    <select
                      className="claims-input claims-role-select"
                      value={l.role}
                      disabled={updatingLinkId === l.id}
                      onChange={(e) => void updateLinkRole(l.id, e.target.value)}
                      aria-label="Snippet role"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="claims-btn-text-danger"
                      disabled={removingLinkId === l.id}
                      onClick={() => void removeLink(l.id)}
                    >
                      {removingLinkId === l.id ? '…' : 'Remove'}
                    </button>
                  </div>
                  <div className="claims-evidence-paper">{p?.title ?? 'Paper'}</div>
                  <div className="claims-evidence-text">{s?.content ?? '—'}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="claims-detail-section">
        <h2>Quick actions</h2>
        <div className="claims-quick-actions">
          <button type="button" className="claims-btn" onClick={() => void copyParagraphPrompt()}>
            Generate paragraph (copy prompt)
          </button>
          <a
            className="claims-btn claims-btn-ghost"
            href={`${base}snippets/?claimId=${encodeURIComponent(claim.id)}`}
          >
            Find more snippets
          </a>
          <button type="button" className="claims-btn claims-btn-ghost" onClick={exportCitations}>
            Export with citations
          </button>
        </div>
        {copyMsg && <p className="claims-copy-msg">{copyMsg}</p>}
      </section>

      <section className="claims-detail-section claims-danger-zone">
        <button type="button" className="claims-btn-text-danger" onClick={() => void deleteClaim()}>
          Delete claim
        </button>
      </section>
    </div>
  );
}
