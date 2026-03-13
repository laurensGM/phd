import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';
import outlineData from '../data/outline.json';

interface OutlineItem {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  notes?: string;
}

const PAPER_STATUSES = [
  { id: 'Not read', label: 'Not read', color: '#9ca3af' }, // slate-400
  { id: '1st reading', label: '1st reading', color: '#60a5fa' }, // blue-400
  { id: '2nd reading', label: '2nd reading', color: '#2dd4bf' }, // teal-400
  { id: 'Read', label: 'Read', color: '#34d399' }, // emerald-400
  { id: 'Completed', label: 'Completed', color: '#fbbf24' }, // amber-400
  { id: 'Archive', label: 'Archive', color: '#a855f7' }, // violet-500
] as const;

interface StatusCount {
  status: string;
  count: number;
}

export default function HomeDashboard() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [papersCount, setPapersCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [snippetsCount, setSnippetsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const constructsCount = Array.isArray(constructsData) ? constructsData.length : 0;
  const modelsCount = Array.isArray(modelsData) ? modelsData.length : 0;

  const timelineMilestones = useMemo(() => {
    const all = (outlineData as OutlineItem[]).slice().sort((a, b) => a.date.localeCompare(b.date));
    // Prefer milestones from the current year (2026); if none, fall back to all
    const year = '2026';
    const list = all.filter((m) => m.date.startsWith(year + '-'));
    const effective = list.length > 0 ? list : all;

    const today = new Date().toISOString().slice(0, 10);
    let nextId: string | null = null;
    for (const m of effective) {
      if (m.date >= today) {
        nextId = m.id;
        break;
      }
    }
    return effective.map((item) => ({
      ...item,
      isPast: item.date < today,
      isNext: item.id === nextId,
    }));
  }, []);

  const daysUntilPrelim = useMemo(() => {
    const items = outlineData as OutlineItem[];
    const prelim =
      items.find((m) => m.id === 'preliminary-literature-review') ??
      items.find((m) => m.title.toLowerCase().includes('preliminary literature review'));
    if (!prelim) return null;
    const today = new Date();
    const target = new Date(prelim.date + 'T00:00:00');
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setPapersCount(0);
      setSnippetsCount(0);
      setStatusCounts(PAPER_STATUSES.map((s) => ({ status: s.label, count: 0 })));
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [papersRes, snippetsRes] = await Promise.all([
          supabase.from('saved_papers').select('id, status'),
          supabase.from('snippets').select('id'),
        ]);
        if (cancelled) return;
        if (papersRes.error) {
          setError(papersRes.error.message);
          setPapersCount(0);
          setStatusCounts([]);
        } else {
          const rows = (papersRes.data ?? []) as { id: string; status: string }[];
          setPapersCount(rows.length);
          const byStatus: Record<string, number> = {};
          for (const s of PAPER_STATUSES) {
            byStatus[s.id] = 0;
          }
          for (const row of rows) {
            const status = row.status?.trim() || 'Not read';
            if (!PAPER_STATUSES.some((x) => x.id === status)) {
              byStatus['Not read'] = (byStatus['Not read'] ?? 0) + 1;
            } else {
              byStatus[status] = (byStatus[status] ?? 0) + 1;
            }
          }
          setStatusCounts(
            PAPER_STATUSES.map((s) => ({ status: s.label, count: byStatus[s.id] ?? 0 }))
          );
        }
        if (snippetsRes.error) {
          setError((e) => e ?? snippetsRes.error.message);
          setSnippetsCount(0);
        } else {
          setSnippetsCount((snippetsRes.data ?? []).length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalForPie = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const conicParts: string[] = [];
  let acc = 0;
  for (let i = 0; i < PAPER_STATUSES.length; i++) {
    const sc = statusCounts[i];
    const pct = totalForPie > 0 ? (sc.count / totalForPie) * 100 : 0;
    const color = PAPER_STATUSES[i].color;
    conicParts.push(`${color} ${acc}% ${acc + pct}%`);
    acc += pct;
  }
  const conicGradient =
    conicParts.length > 0
      ? `conic-gradient(${conicParts.join(', ')})`
      : 'conic-gradient(#e5e7eb 0% 100%)';

  if (loading) {
    return (
      <div className="home-dashboard">
        <p className="home-dashboard-loading">Loading stats…</p>
      </div>
    );
  }

  return (
    <div className="home-dashboard">
      {error && <p className="home-dashboard-error">{error}</p>}
      <div className="home-stats-grid">
        {daysUntilPrelim !== null && (
          <div className="home-stat-card home-stat-deadline">
            <span className="home-stat-value">{daysUntilPrelim}</span>
            <span className="home-stat-label">days before literature review</span>
          </div>
        )}
        <a href={`${base}papers/`} className="home-stat-card home-stat-papers">
          <span className="home-stat-value">{papersCount}</span>
          <span className="home-stat-label">papers saved</span>
        </a>
        <a href={`${base}snippets/`} className="home-stat-card home-stat-snippets">
          <span className="home-stat-value">{snippetsCount}</span>
          <span className="home-stat-label">snippets extracted</span>
        </a>
        <a href={`${base}constructs/`} className="home-stat-card home-stat-constructs">
          <span className="home-stat-value">{constructsCount}</span>
          <span className="home-stat-label">constructs explored</span>
        </a>
        <a href={`${base}models/`} className="home-stat-card home-stat-models">
          <span className="home-stat-value">{modelsCount}</span>
          <span className="home-stat-label">models explored</span>
        </a>
      </div>
      {papersCount > 0 && (
        <section className="home-papers-chart">
          <h2 className="home-section-title">Papers by status</h2>
          <div className="home-pie-legend">
            <div
              className="home-pie-chart"
              style={{ background: conicGradient }}
              aria-hidden
            />
            <ul className="home-pie-legend-list">
              {PAPER_STATUSES.map((s, i) => (
                <li key={s.id} className="home-pie-legend-item">
                  <span
                    className="home-pie-legend-swatch"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="home-pie-legend-label">{s.label}</span>
                  <span className="home-pie-legend-count">{statusCounts[i]?.count ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="home-timeline-section">
        <div className="home-timeline-header">
          <h2 className="home-section-title">Milestones</h2>
          <a href={`${base}outline/`} className="home-timeline-link">View all →</a>
        </div>
        <ul className="home-timeline">
          {timelineMilestones.map((m) => (
            <li
              key={m.id}
              className={`home-timeline-item ${m.isPast ? 'home-timeline-past' : ''} ${m.isNext ? 'home-timeline-next' : ''}`}
            >
              <time className="home-timeline-date" dateTime={m.date}>
                {m.dateLabel}
              </time>
              <span className="home-timeline-dot" aria-hidden />
              <div className="home-timeline-content">
                <span className="home-timeline-title">{m.title}</span>
                {m.isNext && <span className="home-timeline-badge">Next</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
