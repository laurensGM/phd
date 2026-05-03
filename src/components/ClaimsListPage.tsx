import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type ClaimRow = {
  id: string;
  title: string;
  claim_text: string;
  confidence_level: string;
  created_at: string;
};

export default function ClaimsListPage() {
  const base = import.meta.env.BASE_URL || '/';
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: qErr } = await supabase
      .from('claims')
      .select('id, title, claim_text, confidence_level, created_at')
      .order('created_at', { ascending: false });
    if (qErr) setError(qErr.message);
    else setRows((data as ClaimRow[]) ?? []);
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

  if (loading) {
    return (
      <div className="claims-page">
        <p className="claims-muted">Loading claims…</p>
      </div>
    );
  }

  return (
    <div className="claims-page">
      <header className="claims-header">
        <h1>Claims</h1>
        <p className="claims-intro">
          Turn selected snippets into defensible, evidence-linked claims. Each claim stores constructs, confidence, and
          snippet roles (supporting / contradicting / definition).
        </p>
        <a className="claims-primary-btn" href={`${base}claims/new/`}>
          Create claim
        </a>
      </header>
      {error && <p className="claims-error">{error}</p>}
      {rows.length === 0 ? (
        <p className="claims-muted">No claims yet. Start with &ldquo;Create claim&rdquo; to run the guided flow.</p>
      ) : (
        <ul className="claims-list">
          {rows.map((r) => (
            <li key={r.id} className="claims-card">
              <a className="claims-card-link" href={`${base}claims/detail/?id=${encodeURIComponent(r.id)}`}>
                <span className="claims-card-title">{r.title.trim() || 'Untitled claim'}</span>
                <span className={`claims-badge claims-badge-${r.confidence_level}`}>{r.confidence_level}</span>
              </a>
              <p className="claims-card-preview">{r.claim_text}</p>
              <time className="claims-card-date" dateTime={r.created_at}>
                {new Date(r.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
