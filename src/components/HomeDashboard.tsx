import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';
import outlineData from '../data/outline.json';
import fieldsData from '../data/fields.json';
import researchQuestions from '../data/research-questions.json';
import researchObjectives from '../data/research-objectives.json';
import SnippetDistributionChart from './SnippetDistributionChart';
import HomeTasksBarChart from './HomeTasksBarChart';
import HomeResearchPipeline from './HomeResearchPipeline';
import HomeRecentActivity from './HomeRecentActivity';
import PapersYearHistogram from './PapersYearHistogram';
import PaperDistributionPie from './PaperDistributionPie';
import { usePageLoader } from '../hooks/usePageLoader';
import {
  buildChartSlices,
  countTagAssignments,
  getSnippetConstructIds,
  getSnippetModelIds,
  type ChartSlice,
} from '../lib/snippetTagDistribution';
import { buildYearHistogram } from '../lib/paperYearHistogram';
import {
  buildFieldDistributionSlices,
  buildJournalDistributionSlices,
  type PaperJournalRow,
} from '../lib/paperDistribution';
import { manualAssignmentsByPaperId, type FieldDef } from '../lib/fieldPaperMatch';
import {
  activitiesFromVersionedJson,
  groupSnippetActivities,
  mergeRecentActivity,
  truncateText,
  type ActivityItem,
} from '../lib/recentActivity';

interface PaperRow extends PaperJournalRow {
  year: string | null;
}

interface SnippetTagRow {
  id: string;
  construct_ids?: string[] | null;
  model_ids?: string[] | null;
  construct_id?: string | null;
  model_id?: string | null;
  used_in_writing?: boolean | null;
}

interface OutlineItem {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  notes?: string;
}

const PROPOSAL_MILESTONE_IDS = [
  'draft-research-proposal',
  'mock-phd-proposal',
  'final-phd-proposal',
  'phd-proposal-defence',
] as const;

function localTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function nextFocusMilestone(items: OutlineItem[], todayStr: string): OutlineItem | null {
  const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
  const nextProposal = sorted.find(
    (m) => PROPOSAL_MILESTONE_IDS.includes(m.id as (typeof PROPOSAL_MILESTONE_IDS)[number]) && m.date >= todayStr,
  );
  if (nextProposal) return nextProposal;
  return sorted.find((m) => m.date >= todayStr) ?? null;
}

export default function HomeDashboard() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [paperRows, setPaperRows] = useState<PaperRow[]>([]);
  const [snippetsCount, setSnippetsCount] = useState<number>(0);
  const [snippetsProcessedCount, setSnippetsProcessedCount] = useState<number>(0);
  const [claimsCount, setClaimsCount] = useState<number>(0);
  const [contributionsCount, setContributionsCount] = useState<number>(0);
  const [taskCounts, setTaskCounts] = useState({
    backlog: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
  });
  const [snippetRows, setSnippetRows] = useState<SnippetTagRow[]>([]);
  const [manualByPaperId, setManualByPaperId] = useState<Map<string, string[]>>(new Map());
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  usePageLoader(loading);
  const [error, setError] = useState<string | null>(null);

  const versionedActivity = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 4);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recentRq = (researchQuestions as { id: string; date: string; question?: string; version?: string; status?: string }[]).filter(
      (r) => r.date >= cutoffStr
    );
    const recentObjectives = (
      researchObjectives as {
        id: string;
        date: string;
        objective?: string;
        version?: string;
        type?: string;
        status?: string;
      }[]
    ).filter((r) => r.date >= cutoffStr);
    return [
      ...activitiesFromVersionedJson(recentRq, 'research_question', `${base}research-questions/questions/`),
      ...activitiesFromVersionedJson(recentObjectives, 'objective', `${base}research-questions/objectives/`),
    ];
  }, [base]);

  const constructLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of constructsData as { id: string; name: string; abbreviation?: string }[]) {
      map.set(c.id, c.abbreviation ? `${c.name} (${c.abbreviation})` : c.name);
    }
    return map;
  }, []);

  const modelLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of modelsData as { id: string; name: string; abbreviation?: string }[]) {
      map.set(m.id, m.abbreviation ?? m.name);
    }
    return map;
  }, []);

  const papersCount = paperRows.length;

  const yearHistogram = useMemo(
    () => buildYearHistogram(paperRows.map((p) => p.year)),
    [paperRows]
  );

  const fieldsList = useMemo(
    () => fieldsData as FieldDef[],
    []
  );

  const fieldDistributionSlices = useMemo(
    () => buildFieldDistributionSlices(paperRows, fieldsList, manualByPaperId),
    [paperRows, fieldsList, manualByPaperId]
  );

  const journalDistribution = useMemo(
    () => buildJournalDistributionSlices(paperRows),
    [paperRows]
  );

  const constructSlices = useMemo((): ChartSlice[] => {
    const counts = countTagAssignments(snippetRows, getSnippetConstructIds);
    return buildChartSlices(counts, constructLabelById);
  }, [snippetRows, constructLabelById]);

  const modelSlices = useMemo((): ChartSlice[] => {
    const counts = countTagAssignments(snippetRows, getSnippetModelIds);
    return buildChartSlices(counts, modelLabelById);
  }, [snippetRows, modelLabelById]);

  const constructsCount = Array.isArray(constructsData) ? constructsData.length : 0;
  const modelsCount = Array.isArray(modelsData) ? modelsData.length : 0;

  const timelineMilestones = useMemo(() => {
    const all = (outlineData as OutlineItem[]).slice().sort((a, b) => a.date.localeCompare(b.date));
    const year = String(new Date().getFullYear());
    const today = localTodayStr();
    // This year's milestones that are today or still ahead — hide past ones
    const upcomingThisYear = all.filter(
      (m) => m.date.startsWith(`${year}-`) && m.date >= today
    );
    const focus = nextFocusMilestone(upcomingThisYear, today);
    const nextId = focus?.id ?? null;
    return upcomingThisYear.map((item) => ({
      ...item,
      isPast: false,
      isFuture: item.date >= today,
      isNext: item.id === nextId,
    }));
  }, []);

  const nextMilestoneCountdown = useMemo(() => {
    const items = outlineData as OutlineItem[];
    const todayStr = localTodayStr();
    const next = nextFocusMilestone(items, todayStr);
    if (!next) return null;
    const days = daysUntilDate(next.date);
    return {
      days: days < 0 ? 0 : days,
      title: next.title,
      id: next.id,
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setPaperRows([]);
      setSnippetsCount(0);
      setSnippetsProcessedCount(0);
      setClaimsCount(0);
      setContributionsCount(0);
      setTaskCounts({ backlog: 0, todo: 0, in_progress: 0, done: 0 });
      setSnippetRows([]);
      setManualByPaperId(new Map());
      setActivityItems(mergeRecentActivity(versionedActivity, 12));
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          papersRes,
          snippetsRes,
          assignRes,
          claimsRes,
          contributionsRes,
          tasksRes,
          recentPapersRes,
          recentSnippetsRes,
          recentTasksRes,
          recentContributionsRes,
          recentDiaryRes,
          recentMeetingsRes,
          recentFaqsRes,
        ] = await Promise.all([
          supabase.from('saved_papers').select('id, year, journal').limit(2000),
          supabase.from('snippets').select('id, construct_ids, model_ids, construct_id, model_id, used_in_writing'),
          supabase.from('paper_field_assignments').select('paper_id, field_id'),
          supabase.from('claims').select('id', { count: 'exact', head: true }),
          supabase.from('research_contributions').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('status'),
          supabase
            .from('saved_papers')
            .select('id, title, authors, year, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('snippets')
            .select('id, content, created_at')
            .order('created_at', { ascending: false })
            .limit(40),
          supabase
            .from('tasks')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('research_contributions')
            .select('id, content, contribution_type, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('diary_entries')
            .select('id, date, summary, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('meeting_notes')
            .select('id, date, title, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('tool_faqs')
            .select('id, question, created_at')
            .order('created_at', { ascending: false })
            .limit(8),
        ]);
        if (cancelled) return;
        if (papersRes.error) {
          setError(papersRes.error.message);
          setPaperRows([]);
        } else {
          setPaperRows((papersRes.data ?? []) as PaperRow[]);
        }
        if (!assignRes.error) {
          setManualByPaperId(
            manualAssignmentsByPaperId(
              (assignRes.data ?? []) as { paper_id: string; field_id: string }[]
            )
          );
        }
        if (snippetsRes.error) {
          setError((e) => e ?? snippetsRes.error.message);
          setSnippetsCount(0);
          setSnippetsProcessedCount(0);
          setSnippetRows([]);
        } else {
          const rows = (snippetsRes.data ?? []) as SnippetTagRow[];
          setSnippetRows(rows);
          setSnippetsCount(rows.length);
          setSnippetsProcessedCount(rows.filter((row) => Boolean(row.used_in_writing)).length);
        }
        if (claimsRes.error) {
          setClaimsCount(0);
        } else {
          setClaimsCount(claimsRes.count ?? 0);
        }
        if (contributionsRes.error) {
          setContributionsCount(0);
        } else {
          setContributionsCount(contributionsRes.count ?? 0);
        }
        if (tasksRes.error) {
          setTaskCounts({ backlog: 0, todo: 0, in_progress: 0, done: 0 });
        } else {
          const next = { backlog: 0, todo: 0, in_progress: 0, done: 0 };
          for (const row of (tasksRes.data ?? []) as { status: string }[]) {
            if (row.status === 'backlog') next.backlog += 1;
            else if (row.status === 'todo') next.todo += 1;
            else if (row.status === 'in_progress') next.in_progress += 1;
            else if (row.status === 'done') next.done += 1;
          }
          setTaskCounts(next);
        }

        const live: ActivityItem[] = [];

        if (!recentPapersRes.error) {
          for (const row of (recentPapersRes.data ?? []) as {
            id: string;
            title?: string | null;
            authors?: string | null;
            year?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            live.push({
              id: `paper-${row.id}`,
              type: 'paper',
              at: row.created_at,
              title: 'Added a paper',
              detail:
                truncateText(row.title, 110) ||
                truncateText(row.authors, 90) ||
                (row.year ? `Year ${row.year}` : undefined),
              href: `${base}papers/`,
            });
          }
        }

        if (!recentSnippetsRes.error) {
          live.push(
            ...groupSnippetActivities(
              (recentSnippetsRes.data ?? []) as { id: string; content?: string | null; created_at: string }[],
              `${base}snippets/`
            )
          );
        }

        if (!recentTasksRes.error) {
          for (const row of (recentTasksRes.data ?? []) as {
            id: string;
            title?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            live.push({
              id: `task-${row.id}`,
              type: 'task',
              at: row.created_at,
              title: 'Added a task',
              detail: truncateText(row.title, 110) || undefined,
              href: `${base}tasks/`,
            });
          }
        }

        if (!recentContributionsRes.error) {
          for (const row of (recentContributionsRes.data ?? []) as {
            id: string;
            content?: string | null;
            contribution_type?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            const typeLabel = row.contribution_type
              ? ` (${row.contribution_type})`
              : '';
            live.push({
              id: `contribution-${row.id}`,
              type: 'contribution',
              at: row.created_at,
              title: `Added a contribution${typeLabel}`,
              detail: truncateText(row.content, 110) || undefined,
              href: `${base}research-questions/contribution/`,
            });
          }
        }

        if (!recentDiaryRes.error) {
          for (const row of (recentDiaryRes.data ?? []) as {
            id: string;
            date?: string | null;
            summary?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            live.push({
              id: `diary-${row.id}`,
              type: 'diary',
              at: row.created_at,
              title: row.date ? `Added a diary entry (${row.date})` : 'Added a diary entry',
              detail: truncateText(row.summary, 110) || undefined,
              href: `${base}diary/`,
            });
          }
        }

        if (!recentMeetingsRes.error) {
          for (const row of (recentMeetingsRes.data ?? []) as {
            id: string;
            date?: string | null;
            title?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            live.push({
              id: `meeting-${row.id}`,
              type: 'meeting',
              at: row.created_at,
              title: 'Added a meeting note',
              detail:
                truncateText(row.title, 110) ||
                (row.date ? `Meeting on ${row.date}` : undefined),
              href: `${base}meeting-notes/`,
            });
          }
        }

        if (!recentFaqsRes.error) {
          for (const row of (recentFaqsRes.data ?? []) as {
            id: string;
            question?: string | null;
            created_at: string;
          }[]) {
            if (!row.created_at) continue;
            live.push({
              id: `faq-${row.id}`,
              type: 'faq',
              at: row.created_at,
              title: 'Added an FAQ',
              detail: truncateText(row.question, 110) || undefined,
              href: `${base}tools/faq/`,
            });
          }
        }

        setActivityItems(mergeRecentActivity([...live, ...versionedActivity], 12));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, versionedActivity]);

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

      <div className="home-top-row">
        <section className="home-timeline-section" aria-label="Milestones this year">
          <div className="home-timeline-header">
            <h2 className="home-section-title">Milestones this year</h2>
            <a href={`${base}outline/`} className="home-timeline-link">
              View all →
            </a>
          </div>
          {nextMilestoneCountdown !== null && (
            <a href={`${base}outline/`} className="home-timeline-countdown">
              <span className="home-timeline-countdown-value">{nextMilestoneCountdown.days}</span>
              <span className="home-timeline-countdown-label">
                days until {nextMilestoneCountdown.title.toLowerCase()}
              </span>
            </a>
          )}
          {timelineMilestones.length === 0 ? (
            <p className="home-timeline-empty">No upcoming milestones this year.</p>
          ) : (
            <ul className="home-timeline">
              {timelineMilestones.map((m) => (
                <li
                  key={m.id}
                  className={`home-timeline-item ${m.isFuture && !m.isNext ? 'home-timeline-future' : ''} ${m.isNext ? 'home-timeline-next' : ''}`}
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
          )}
        </section>

        <section className="home-tasks-section" aria-label="Tasks board summary">
          <div className="home-tasks-header">
            <h2 className="home-section-title">Tasks board</h2>
            <a href={`${base}tasks/`} className="home-timeline-link">
              Open board →
            </a>
          </div>
          <HomeTasksBarChart counts={taskCounts} />
        </section>
      </div>

      <HomeRecentActivity items={activityItems} />

      <HomeResearchPipeline
        stages={[
          {
            key: 'snippets',
            label: 'Snippets extracted',
            count: snippetsCount,
            href: `${base}snippets/`,
            color: '#9C416B',
          },
          {
            key: 'snippets-processed',
            label: 'Snippets processed',
            count: snippetsProcessedCount,
            href: `${base}snippets/`,
            color: '#712038',
          },
          {
            key: 'claims',
            label: 'Claims made',
            count: claimsCount,
            href: `${base}claims/`,
            color: '#8B704C',
          },
          {
            key: 'contributions',
            label: 'Contributions',
            count: contributionsCount,
            href: `${base}research-questions/contribution/`,
            color: '#D4AF37',
          },
        ]}
      />

      {papersCount > 0 && (
        <PapersYearHistogram
          bins={yearHistogram.bins}
          withoutYear={yearHistogram.withoutYear}
          totalPapers={papersCount}
          papersHref={`${base}papers/`}
        />
      )}

      {papersCount > 0 && (
        <section className="home-paper-pies-section">
          <div className="home-paper-pies-header">
            <h2 className="home-section-title">Paper library</h2>
            <p className="home-paper-pies-note">
              Fields use journal matching plus any manual links from the Fields page. Journals with only one paper are grouped as Other.
            </p>
          </div>
          <div className="home-paper-pies-grid">
            <PaperDistributionPie
              title="By field"
              totalPapers={papersCount}
              slices={fieldDistributionSlices}
              emptyMessage="No papers matched to a research field yet (check journal names)."
              subtitle="Journal match + manual field links"
            />
            <PaperDistributionPie
              title="By journal"
              totalPapers={papersCount}
              slices={journalDistribution.slices}
              emptyMessage="No papers with a journal name yet."
              subtitle={
                journalDistribution.withoutJournal > 0
                  ? `${journalDistribution.withoutJournal} paper${journalDistribution.withoutJournal !== 1 ? 's' : ''} without journal not shown`
                  : undefined
              }
            />
          </div>
        </section>
      )}

      {snippetsCount > 0 && (
        <section className="home-snippet-charts-section">
          <div className="home-snippet-charts-header">
            <h2 className="home-section-title">Snippet tags</h2>
            <p className="home-snippet-charts-note">
              Snippets can have multiple tags; each tag is counted once. Single-use tags are grouped as Other.
            </p>
          </div>
          <div className="home-snippet-charts-grid">
            <SnippetDistributionChart
              title="By construct"
              totalSnippets={snippetsCount}
              slices={constructSlices}
              emptyMessage="No snippets tagged with a construct yet."
              exploredCount={constructsCount}
              exploredLabel="constructs explored"
              exploredHref={`${base}constructs/`}
            />
            <SnippetDistributionChart
              title="By model"
              totalSnippets={snippetsCount}
              slices={modelSlices}
              emptyMessage="No snippets tagged with a model yet."
              exploredCount={modelsCount}
              exploredLabel="models explored"
              exploredHref={`${base}models/`}
            />
          </div>
        </section>
      )}
    </div>
  );
}
