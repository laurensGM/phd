-- One permission per main-menu item (columns in admin matrix)

-- Remove legacy view/edit keys
delete from public.role_permissions
where permission_key in (
  'admin.access',
  'members.manage',
  'papers.view', 'papers.edit',
  'snippets.view', 'snippets.edit',
  'claims.view', 'claims.edit',
  'diary.view', 'diary.edit',
  'tasks.view', 'tasks.edit',
  'meeting_notes.view', 'meeting_notes.edit',
  'documents.view', 'documents.edit',
  'writing.humanize', 'writing.lr_process'
);

delete from public.app_permissions
where key in (
  'admin.access',
  'members.manage',
  'papers.view', 'papers.edit',
  'snippets.view', 'snippets.edit',
  'claims.view', 'claims.edit',
  'diary.view', 'diary.edit',
  'tasks.view', 'tasks.edit',
  'meeting_notes.view', 'meeting_notes.edit',
  'documents.view', 'documents.edit',
  'writing.humanize', 'writing.lr_process'
);

insert into public.app_permissions (key, label, description, category, sort_order) values
  ('nav.literature.papers', 'Papers', null, 'Literature', 10),
  ('nav.literature.models', 'Models', null, 'Literature', 20),
  ('nav.literature.constructs', 'Constructs', null, 'Literature', 30),
  ('nav.literature.fields', 'Fields', null, 'Literature', 40),
  ('nav.literature.snippets', 'Snippets', null, 'Literature', 50),
  ('nav.literature.claims', 'Claims', null, 'Literature', 60),
  ('nav.literature.academics', 'Academics', null, 'Literature', 70),
  ('nav.literature.theory_map', 'Theory Map', null, 'Literature', 80),
  ('nav.writing.words', 'Words', null, 'Writing', 10),
  ('nav.writing.revise_edit', 'Revise and edit', null, 'Writing', 20),
  ('nav.writing.argument', 'Argument', null, 'Writing', 30),
  ('nav.writing.humanize', 'Humanize', null, 'Writing', 40),
  ('nav.writing.slr', 'SLR', null, 'Writing', 50),
  ('nav.writing.lr_process', 'LR process', null, 'Writing', 60),
  ('nav.methods.qual_vs_quant', 'Qual vs Quant', null, 'Methods', 10),
  ('nav.methods.quant', 'Quant', null, 'Methods', 20),
  ('nav.methods.qual', 'Qual', null, 'Methods', 30),
  ('nav.methods.secondary_data', 'Secondary data', null, 'Methods', 40),
  ('nav.methods.sampling', 'Sampling', null, 'Methods', 50),
  ('nav.methods.theory_maturity', 'Theory maturity', null, 'Methods', 60),
  ('nav.methods.uoa', 'UoA', null, 'Methods', 70),
  ('nav.methods.ethics', 'Ethics', null, 'Methods', 80),
  ('nav.research.process', 'Process', null, 'Research', 10),
  ('nav.research.proposal', 'Proposal', null, 'Research', 20),
  ('nav.research.paradigms', 'Paradigms', null, 'Research', 30),
  ('nav.research.questions', 'Questions', null, 'Research', 40),
  ('nav.research.objectives', 'Objectives', null, 'Research', 50),
  ('nav.research.contribution', 'Contribution', null, 'Research', 60),
  ('nav.research.must_dos', '10 must do''s', null, 'Research', 70),
  ('nav.tools.ai', 'AI tools', null, 'Tools', 10),
  ('nav.tools.databases', 'Databases', null, 'Tools', 20),
  ('nav.tools.golden_nuggets', 'Golden nuggets', null, 'Tools', 30),
  ('nav.tools.faq', 'FAQ', null, 'Tools', 40),
  ('nav.tools.memes', 'Memes', null, 'Tools', 50),
  ('nav.manager.milestones', 'PhD milestones', null, 'Manager', 10),
  ('nav.manager.phd_outline', 'PhD outline', null, 'Manager', 20),
  ('nav.manager.diary', 'Diary', null, 'Manager', 30),
  ('nav.manager.tasks', 'Tasks', null, 'Manager', 40),
  ('nav.manager.meeting_notes', 'Meeting notes', null, 'Manager', 50),
  ('nav.manager.documents', 'Documents', null, 'Manager', 60),
  ('nav.manager.supervisors', 'Supervisors', null, 'Manager', 70),
  ('nav.manager.admin', 'Admin panel', 'Roles & permissions admin UI', 'Manager', 80),
  ('nav.manager.members', 'Project members', 'Invite and manage project members', 'Manager', 90)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order;

-- Default matrix: superadmin all; student all except admin + superadmin writing tools;
-- supervisor read-mostly (no diary, admin, members, humanize, lr_process)
insert into public.role_permissions (role, permission_key, allowed)
select r.role, p.key,
  case
    when r.role = 'superadmin' then true
    when r.role = 'student' and p.key in ('nav.manager.admin', 'nav.writing.humanize', 'nav.writing.lr_process') then false
    when r.role = 'supervisor' and p.key in (
      'nav.manager.diary',
      'nav.manager.admin',
      'nav.manager.members',
      'nav.writing.humanize',
      'nav.writing.lr_process'
    ) then false
    when r.role = 'supervisor' then true
    else true
  end
from public.app_permissions p
cross join (values ('superadmin'), ('student'), ('supervisor')) as r(role)
where p.key like 'nav.%'
on conflict (role, permission_key) do update set
  allowed = excluded.allowed,
  updated_at = now();
