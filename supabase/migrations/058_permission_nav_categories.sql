-- Align permission categories with main navbar sections for split admin tables

update public.app_permissions set category = 'Manager', sort_order = 5 where key = 'admin.access';
update public.app_permissions set category = 'Manager', sort_order = 15 where key = 'members.manage';

update public.app_permissions set category = 'Literature', sort_order = 30 where key = 'papers.view';
update public.app_permissions set category = 'Literature', sort_order = 40 where key = 'papers.edit';
update public.app_permissions set category = 'Literature', sort_order = 50 where key = 'snippets.view';
update public.app_permissions set category = 'Literature', sort_order = 60 where key = 'snippets.edit';
update public.app_permissions set category = 'Literature', sort_order = 70 where key = 'claims.view';
update public.app_permissions set category = 'Literature', sort_order = 80 where key = 'claims.edit';

update public.app_permissions set category = 'Writing', sort_order = 170 where key = 'writing.humanize';
update public.app_permissions set category = 'Writing', sort_order = 180 where key = 'writing.lr_process';

update public.app_permissions set category = 'Manager', sort_order = 90 where key = 'diary.view';
update public.app_permissions set category = 'Manager', sort_order = 100 where key = 'diary.edit';
update public.app_permissions set category = 'Manager', sort_order = 110 where key = 'tasks.view';
update public.app_permissions set category = 'Manager', sort_order = 120 where key = 'tasks.edit';
update public.app_permissions set category = 'Manager', sort_order = 130 where key = 'meeting_notes.view';
update public.app_permissions set category = 'Manager', sort_order = 140 where key = 'meeting_notes.edit';
update public.app_permissions set category = 'Manager', sort_order = 150 where key = 'documents.view';
update public.app_permissions set category = 'Manager', sort_order = 160 where key = 'documents.edit';
