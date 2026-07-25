import researchQuestions from '../data/research-questions.json';
import researchObjectives from '../data/research-objectives.json';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  activitiesFromVersionedJson,
  groupSnippetActivities,
  mergeRecentActivity,
  truncateText,
  type ActivityItem,
} from './recentActivity';

function versionedActivity(base: string): ActivityItem[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 4);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentRq = (
    researchQuestions as { id: string; date: string; question?: string; version?: string; status?: string }[]
  ).filter((r) => r.date >= cutoffStr);
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
}

function buildLiveFromRows(
  base: string,
  rows: {
    papers?: { id: string; title?: string | null; authors?: string | null; year?: string | null; created_at: string }[];
    snippets?: { id: string; content?: string | null; created_at: string }[];
    tasks?: { id: string; title?: string | null; created_at: string }[];
    contributions?: {
      id: string;
      content?: string | null;
      contribution_type?: string | null;
      created_at: string;
    }[];
    diary?: { id: string; date?: string | null; summary?: string | null; created_at: string }[];
    meetings?: { id: string; date?: string | null; title?: string | null; created_at: string }[];
    faqs?: { id: string; question?: string | null; created_at: string }[];
  }
): ActivityItem[] {
  const live: ActivityItem[] = [];

  for (const row of rows.papers ?? []) {
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

  live.push(...groupSnippetActivities(rows.snippets ?? [], `${base}snippets/`));

  for (const row of rows.tasks ?? []) {
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

  for (const row of rows.contributions ?? []) {
    if (!row.created_at) continue;
    const typeLabel = row.contribution_type ? ` (${row.contribution_type})` : '';
    live.push({
      id: `contribution-${row.id}`,
      type: 'contribution',
      at: row.created_at,
      title: `Added a contribution${typeLabel}`,
      detail: truncateText(row.content, 110) || undefined,
      href: `${base}research-questions/contribution/`,
    });
  }

  for (const row of rows.diary ?? []) {
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

  for (const row of rows.meetings ?? []) {
    if (!row.created_at) continue;
    live.push({
      id: `meeting-${row.id}`,
      type: 'meeting',
      at: row.created_at,
      title: 'Added a meeting note',
      detail: truncateText(row.title, 110) || (row.date ? `Meeting on ${row.date}` : undefined),
      href: `${base}meeting-notes/`,
    });
  }

  for (const row of rows.faqs ?? []) {
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

  return live;
}

/** Load and merge recent activity. `resultLimit` is the final list size. */
export async function loadRecentActivity(
  base: string,
  resultLimit: number,
  perSourceLimit = 30
): Promise<ActivityItem[]> {
  const versioned = versionedActivity(base);

  if (!isSupabaseConfigured() || !supabase) {
    return mergeRecentActivity(versioned, resultLimit);
  }

  const [papersRes, snippetsRes, tasksRes, contributionsRes, diaryRes, meetingsRes, faqsRes] =
    await Promise.all([
      supabase
        .from('saved_papers')
        .select('id, title, authors, year, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
      supabase
        .from('snippets')
        .select('id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.max(perSourceLimit * 2, 40)),
      supabase
        .from('tasks')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
      supabase
        .from('research_contributions')
        .select('id, content, contribution_type, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
      supabase
        .from('diary_entries')
        .select('id, date, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
      supabase
        .from('meeting_notes')
        .select('id, date, title, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
      supabase
        .from('tool_faqs')
        .select('id, question, created_at')
        .order('created_at', { ascending: false })
        .limit(perSourceLimit),
    ]);

  const live = buildLiveFromRows(base, {
    papers: !papersRes.error ? ((papersRes.data ?? []) as any) : [],
    snippets: !snippetsRes.error ? ((snippetsRes.data ?? []) as any) : [],
    tasks: !tasksRes.error ? ((tasksRes.data ?? []) as any) : [],
    contributions: !contributionsRes.error ? ((contributionsRes.data ?? []) as any) : [],
    diary: !diaryRes.error ? ((diaryRes.data ?? []) as any) : [],
    meetings: !meetingsRes.error ? ((meetingsRes.data ?? []) as any) : [],
    faqs: !faqsRes.error ? ((faqsRes.data ?? []) as any) : [],
  });

  return mergeRecentActivity([...live, ...versioned], resultLimit);
}
