import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { claimLrChapterLabel } from '../constants/claimLrChapters';
import { usePageLoader } from '../hooks/usePageLoader';
import { usePermissions } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';

type ClaimRow = {
  id: string;
  title: string;
  claim_text: string;
  lr_chapter: string | null;
  created_at: string;
  snippet_count: number;
};

export default function ClaimsListPage() {
  const base = import.meta.env.BASE_URL || '/';
  const { loading: permLoading, canViewClaims, canEditClaims } = usePermissions();
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  usePageLoader(loading || permLoading);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setError(null);
    const [claimsRes, linksRes] = await Promise.all([
      supabase
        .from('claims')
        .select('id, title, claim_text, lr_chapter, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('claim_snippets').select('claim_id'),
    ]);
    if (claimsRes.error) {
      setError(claimsRes.error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    if (linksRes.error) {
      setError(linksRes.error.message);
    }

    const counts = new Map<string, number>();
    for (const link of linksRes.data ?? []) {
      const claimId = (link as { claim_id: string }).claim_id;
      counts.set(claimId, (counts.get(claimId) ?? 0) + 1);
    }

    setRows(
      ((claimsRes.data as Omit<ClaimRow, 'snippet_count'>[]) ?? []).map((claim) => ({
        ...claim,
        snippet_count: counts.get(claim.id) ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="claims-page">
        <p className="claims-error">
          Supabase is not configured. Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    );
  }

  if (loading || permLoading) {
    return (
      <div className="claims-page">
        <p className="claims-muted">Loading claims…</p>
      </div>
    );
  }

  if (!canViewClaims) {
    return (
      <AccessDenied message="Your role cannot view claims." permission="nav.literature.claims" />
    );
  }

  return (
    <div className="claims-page">
      <header className="claims-header">
        <h1>Claims</h1>
        <p className="claims-intro">
          Turn selected snippets into defensible, evidence-linked claims. Each claim stores constructs, LR chapter
          placement, and snippet roles (supporting / contradicting / definition).
        </p>
        {canEditClaims && (
        <div className="claims-header-actions">
          <a className="claims-primary-btn" href={`${base}claims/manual/`}>
            Write claim
          </a>
          <a className="claims-btn claims-btn-ghost claims-header-secondary" href={`${base}claims/new/`}>
            Guided builder
          </a>
        </div>
        )}
      </header>
      {!canEditClaims && (
        <p className="claims-muted" role="status">
          View-only: your role cannot create or edit claims.
        </p>
      )}
      {error && <p className="claims-error">{error}</p>}
      {rows.length === 0 ? (
        <p className="claims-muted">No claims yet. Use &ldquo;Write claim&rdquo; for a quick manual entry, or the guided builder for snippet-first flow.</p>
      ) : (
        <ul className="claims-list">
          {rows.map((r) => {
            const detailHref = `${base}claims/detail/?id=${encodeURIComponent(r.id)}`;
            const editHref = `${detailHref}&edit=1`;
            const snippetLabel =
              r.snippet_count === 1 ? '1 snippet' : `${r.snippet_count} snippets`;
            return (
              <li key={r.id} className="claims-card">
                <div className="claims-card-top">
                  <a className="claims-card-link" href={detailHref}>
                    <span className="claims-card-title">{r.title.trim() || 'Untitled claim'}</span>
                    {claimLrChapterLabel(r.lr_chapter) && (
                      <span className="claims-badge claims-badge-lr">{claimLrChapterLabel(r.lr_chapter)}</span>
                    )}
                  </a>
                  <div className="claims-card-actions">
                    <a className="claims-card-action" href={detailHref}>
                      View
                    </a>
                    {canEditClaims && (
                    <a className="claims-card-action claims-card-action-edit" href={editHref}>
                      Edit
                    </a>
                    )}
                  </div>
                </div>
                <p className="claims-card-preview">{r.claim_text}</p>
                <div className="claims-card-meta">
                  <span className="claims-card-snippet-count">{snippetLabel}</span>
                  <time className="claims-card-date" dateTime={r.created_at}>
                    {new Date(r.created_at).toLocaleString()}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
