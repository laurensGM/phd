export type ActivityType =
  | 'task'
  | 'contribution'
  | 'snippets'
  | 'paper'
  | 'diary'
  | 'meeting'
  | 'research_question'
  | 'objective'
  | 'faq';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  at: string;
  title: string;
  detail?: string;
  href: string;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  task: 'Task',
  contribution: 'Contribution',
  snippets: 'Snippets',
  paper: 'Paper',
  diary: 'Diary',
  meeting: 'Meeting',
  research_question: 'Research question',
  objective: 'Objective',
  faq: 'FAQ',
};

export function activityTypeLabel(type: ActivityType): string {
  return ACTIVITY_LABELS[type];
}

export function truncateText(text: string | null | undefined, max = 100): string {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function relativeActivityTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mergeRecentActivity(items: ActivityItem[], limit = 12): ActivityItem[] {
  return items
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Group snippet rows by calendar day into single “Added N snippets” items. */
export function groupSnippetActivities(
  rows: { id: string; content?: string | null; created_at: string }[],
  snippetsHref: string
): ActivityItem[] {
  const byDay = new Map<string, { at: string; count: number; preview: string }>();
  for (const row of rows) {
    if (!row.created_at) continue;
    const key = dayKey(row.created_at);
    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, {
        at: row.created_at,
        count: 1,
        preview: truncateText(row.content, 90),
      });
    } else {
      existing.count += 1;
      if (row.created_at > existing.at) existing.at = row.created_at;
    }
  }
  return [...byDay.entries()].map(([day, g]) => ({
    id: `snippets-${day}`,
    type: 'snippets' as const,
    at: g.at,
    title: g.count === 1 ? 'Added a snippet' : `Added ${g.count} snippets`,
    detail: g.preview || undefined,
    href: snippetsHref,
  }));
}

export function activitiesFromVersionedJson(
  rows: { id: string; date: string; question?: string; objective?: string; version?: string; type?: string; status?: string }[],
  kind: 'research_question' | 'objective',
  href: string
): ActivityItem[] {
  return rows
    .filter((r) => r.date)
    .map((r) => {
      const text = kind === 'research_question' ? r.question : r.objective;
      const verb = r.status === 'current' ? 'Updated' : 'Recorded';
      const label =
        kind === 'research_question'
          ? `${verb} research question${r.version ? ` (${r.version})` : ''}`
          : `${verb} ${r.type === 'secondary' ? 'secondary' : 'primary'} objective${r.version ? ` (${r.version})` : ''}`;
      return {
        id: `${kind}-${r.id}`,
        type: kind,
        at: `${r.date}T12:00:00`,
        title: label,
        detail: truncateText(text, 110) || undefined,
        href,
      };
    });
}
