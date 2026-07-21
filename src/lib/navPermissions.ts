/**
 * One permission key per main-menu item (and profile admin/members under Manager).
 * Source of truth for admin matrix columns and nav/page gating.
 */

export type NavSectionId = 'Literature' | 'Writing' | 'Methods' | 'Research' | 'Tools' | 'Manager';

export type NavPermissionItem = {
  key: string;
  label: string;
  /** App path after base URL, e.g. `papers/` — used for page gating. */
  pathPrefix: string;
  description?: string;
};

export type NavPermissionSection = {
  id: NavSectionId;
  label: string;
  hint?: string;
  items: NavPermissionItem[];
};

export const NAV_PERMISSION_SECTIONS: NavPermissionSection[] = [
  {
    id: 'Literature',
    label: 'Literature',
    hint: 'Papers, snippets, claims',
    items: [
      { key: 'nav.literature.papers', label: 'Papers', pathPrefix: 'papers/' },
      { key: 'nav.literature.models', label: 'Models', pathPrefix: 'models/' },
      { key: 'nav.literature.constructs', label: 'Constructs', pathPrefix: 'constructs/' },
      { key: 'nav.literature.fields', label: 'Fields', pathPrefix: 'fields/' },
      { key: 'nav.literature.snippets', label: 'Snippets', pathPrefix: 'snippets/' },
      { key: 'nav.literature.claims', label: 'Claims', pathPrefix: 'claims/' },
      { key: 'nav.literature.academics', label: 'Academics', pathPrefix: 'academics/' },
      { key: 'nav.literature.theory_map', label: 'Theory Map', pathPrefix: 'theory-map/' },
    ],
  },
  {
    id: 'Writing',
    label: 'Writing',
    hint: 'Writing guides and LR workflow',
    items: [
      { key: 'nav.writing.words', label: 'Words', pathPrefix: 'tools/writing/' },
      { key: 'nav.writing.revise_edit', label: 'Revise and edit', pathPrefix: 'writing/revise-and-edit/' },
      { key: 'nav.writing.argument', label: 'Argument', pathPrefix: 'writing/argument/' },
      { key: 'nav.writing.humanize', label: 'Humanize', pathPrefix: 'writing/humanize/' },
      { key: 'nav.writing.slr', label: 'SLR', pathPrefix: 'slr/' },
      { key: 'nav.writing.lr_process', label: 'LR process', pathPrefix: 'writing/lr-process/' },
    ],
  },
  {
    id: 'Methods',
    label: 'Methods',
    items: [
      { key: 'nav.methods.qual_vs_quant', label: 'Qual vs Quant', pathPrefix: 'methods/qual-vs-quant/' },
      { key: 'nav.methods.quant', label: 'Quant', pathPrefix: 'methods/quant/' },
      { key: 'nav.methods.qual', label: 'Qual', pathPrefix: 'methods/qual/' },
      { key: 'nav.methods.secondary_data', label: 'Secondary data', pathPrefix: 'methods/secondary-data/' },
      { key: 'nav.methods.sampling', label: 'Sampling', pathPrefix: 'methods/sampling/' },
      { key: 'nav.methods.theory_maturity', label: 'Theory maturity', pathPrefix: 'methods/theory-maturity/' },
      { key: 'nav.methods.uoa', label: 'UoA', pathPrefix: 'methods/uoa/' },
      { key: 'nav.methods.ethics', label: 'Ethics', pathPrefix: 'methods/ethics/' },
    ],
  },
  {
    id: 'Research',
    label: 'Research',
    items: [
      { key: 'nav.research.process', label: 'Process', pathPrefix: 'research-questions/process/' },
      { key: 'nav.research.proposal', label: 'Proposal', pathPrefix: 'research-questions/proposal/' },
      { key: 'nav.research.paradigms', label: 'Paradigms', pathPrefix: 'research-questions/paradigms/' },
      { key: 'nav.research.questions', label: 'Questions', pathPrefix: 'research-questions/questions/' },
      { key: 'nav.research.objectives', label: 'Objectives', pathPrefix: 'research-questions/objectives/' },
      { key: 'nav.research.contribution', label: 'Contribution', pathPrefix: 'research-questions/contribution/' },
      { key: 'nav.research.must_dos', label: "10 must do's", pathPrefix: 'research-questions/must-dos/' },
    ],
  },
  {
    id: 'Tools',
    label: 'Tools',
    items: [
      { key: 'nav.tools.ai', label: 'AI tools', pathPrefix: 'tools/ai/' },
      { key: 'nav.tools.databases', label: 'Databases', pathPrefix: 'tools/databases/' },
      { key: 'nav.tools.golden_nuggets', label: 'Golden nuggets', pathPrefix: 'tools/golden-nuggets/' },
      { key: 'nav.tools.faq', label: 'FAQ', pathPrefix: 'tools/faq/' },
      { key: 'nav.tools.memes', label: 'Memes', pathPrefix: 'tools/memes/' },
    ],
  },
  {
    id: 'Manager',
    label: 'Manager',
    hint: 'Diary, tasks, meeting notes, documents, admin',
    items: [
      { key: 'nav.manager.milestones', label: 'PhD milestones', pathPrefix: 'outline/' },
      { key: 'nav.manager.phd_outline', label: 'PhD outline', pathPrefix: 'phd-outline/' },
      { key: 'nav.manager.diary', label: 'Diary', pathPrefix: 'diary/' },
      { key: 'nav.manager.tasks', label: 'Tasks', pathPrefix: 'tasks/' },
      { key: 'nav.manager.meeting_notes', label: 'Meeting notes', pathPrefix: 'meeting-notes/' },
      { key: 'nav.manager.documents', label: 'Documents', pathPrefix: 'documents/' },
      { key: 'nav.manager.supervisors', label: 'Supervisors', pathPrefix: 'supervisor/' },
      {
        key: 'nav.manager.admin',
        label: 'Admin panel',
        pathPrefix: 'admin/',
        description: 'Roles & permissions admin UI',
      },
      {
        key: 'nav.manager.members',
        label: 'Project members',
        pathPrefix: 'members/',
        description: 'Invite and manage project members',
      },
    ],
  },
];

export const ALL_NAV_PERMISSION_ITEMS: NavPermissionItem[] = NAV_PERMISSION_SECTIONS.flatMap(
  (s) => s.items
);

/** Longest path prefix wins (e.g. tools/writing before tools/). */
const PATH_MATCHERS = [...ALL_NAV_PERMISSION_ITEMS]
  .map((item) => ({ key: item.key, prefix: item.pathPrefix.replace(/^\/+/, '') }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

export function normalizeAppPath(pathname: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  let path = pathname;
  if (path.startsWith(base)) path = path.slice(base.length);
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function permissionKeyForPath(pathname: string): string | null {
  const path = normalizeAppPath(pathname);
  if (!path) return null;
  for (const { key, prefix } of PATH_MATCHERS) {
    const bare = prefix.replace(/\/$/, '');
    if (path === bare || path.startsWith(`${bare}/`)) return key;
  }
  return null;
}
