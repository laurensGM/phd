-- Merge legacy ECM model id into canonical ECM-IS model id for snippets.
update public.snippets
set model_id = 'ecm-is'
where model_id in ('ecm', 'ecm-is');
