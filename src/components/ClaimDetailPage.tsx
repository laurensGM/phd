import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import { buildParagraphFromClaimPrompt } from '../lib/claimAiPrompt';

type Claim = {
  id: string;
  title: string;
  claim_text: string;
  constructs_involved: string[];
  relationship_type: string | null;
  confidence_level: string;
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

export default function ClaimDetailPage() {
  const base = import.meta.env.BASE_URL || '/';
  const [claim, setClaim] = useState<Claim | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [snippets, setSnippets] = useState<Map<string, Snippet>>(new Map());
  const [papers, setPapers] = useState<Map<string, Paper>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

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

  if (error || !claim) {
    return (
      <div className="claims-page">
        <p className="claims-back">
          <a href={`${base}claims/`}>← Claims</a>
        </p>
        <p className="claims-error">{error ?? 'Not found.'}</p>
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
        <h1>{claim.title.trim() || 'Claim'}</h1>
        <p className="claims-detail-meta">
          <span className={`claims-badge claims-badge-${claim.confidence_level}`}>{claim.confidence_level}</span>
          {claim.relationship_type && <span className="claims-pill">{claim.relationship_type}</span>}
          <time dateTime={claim.created_at}>{new Date(claim.created_at).toLocaleString()}</time>
        </p>
      </header>

      <section className="claims-detail-section">
        <h2>Claim</h2>
        <blockquote className="claims-detail-claim">{claim.claim_text}</blockquote>
      </section>

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

      {claim.notes && (
        <section className="claims-detail-section">
          <h2>Notes</h2>
          <p className="claims-notes">{claim.notes}</p>
        </section>
      )}

      <section className="claims-detail-section">
        <h2>Linked snippets</h2>
        <p className="claims-muted">
          Supporting: {supporting.length} · Contradicting: {contradicting.length} · Definition: {definitions.length}
        </p>
        <ul className="claims-evidence-list">
          {links.map((l) => {
            const s = snippets.get(l.snippet_id);
            const p = s ? papers.get(s.paper_id) : undefined;
            return (
              <li key={l.id} className="claims-evidence-card">
                <span className={`claims-role-tag claims-role-${l.role}`}>{l.role}</span>
                <div className="claims-evidence-paper">{p?.title ?? 'Paper'}</div>
                <div className="claims-evidence-text">{s?.content ?? '—'}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="claims-detail-section">
        <h2>Quick actions</h2>
        <div className="claims-quick-actions">
          <button type="button" className="claims-btn" onClick={() => void copyParagraphPrompt()}>
            Generate paragraph (copy prompt)
          </button>
          <a className="claims-btn claims-btn-ghost" href={`${base}snippets/`}>
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
