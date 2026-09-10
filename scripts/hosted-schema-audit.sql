-- Lume hosted schema audit (READ ONLY).
-- Paste the whole block into Supabase Dashboard → SQL Editor → New query → Run.
-- Returns one table. Does not write data. Does not expose secrets.
--
-- Send the full result back. Especially every row where detail = 'MISSING'.
-- recent_project / leftover_children rows are last-24h projects in THIS database.
-- Match them against the failed smoke-test name. Do not paste unrelated dumps.

with wanted_tables(table_name) as (
  values
    ('projects'),
    ('stakeholders'),
    ('todos'),
    ('risks'),
    ('knowledge_items'),
    ('milestones'),
    ('recommendations'),
    ('memories'),
    ('project_tags'),
    ('item_tags')
),
required_columns(table_name, column_name) as (
  values
    ('projects', 'id'),
    ('projects', 'workspace_id'),
    ('projects', 'name'),
    ('projects', 'code'),
    ('projects', 'summary'),
    ('projects', 'status'),
    ('projects', 'kind'),
    ('projects', 'current_focus'),
    ('projects', 'next_milestone'),
    ('projects', 'next_milestone_on'),
    ('projects', 'created_by'),
    ('stakeholders', 'id'),
    ('stakeholders', 'workspace_id'),
    ('stakeholders', 'project_id'),
    ('stakeholders', 'name'),
    ('stakeholders', 'role'),
    ('stakeholders', 'preferences'),
    ('stakeholders', 'concerns'),
    ('todos', 'id'),
    ('todos', 'workspace_id'),
    ('todos', 'project_id'),
    ('todos', 'title'),
    ('todos', 'detail'),
    ('todos', 'done'),
    ('todos', 'due_on'),
    ('todos', 'kind'),
    ('todos', 'waiting_on'),
    ('todos', 'created_by'),
    ('risks', 'id'),
    ('risks', 'workspace_id'),
    ('risks', 'project_id'),
    ('risks', 'title'),
    ('risks', 'status'),
    ('risks', 'source'),
    ('risks', 'created_by'),
    ('knowledge_items', 'id'),
    ('knowledge_items', 'workspace_id'),
    ('knowledge_items', 'project_id'),
    ('knowledge_items', 'section'),
    ('knowledge_items', 'body'),
    ('knowledge_items', 'position'),
    ('knowledge_items', 'created_by'),
    ('knowledge_items', 'kind'),
    ('knowledge_items', 'epistemic'),
    ('knowledge_items', 'lifecycle'),
    ('knowledge_items', 'supersedes_id'),
    ('knowledge_items', 'meta'),
    ('knowledge_items', 'provenance'),
    ('milestones', 'id'),
    ('milestones', 'workspace_id'),
    ('milestones', 'project_id'),
    ('milestones', 'label'),
    ('milestones', 'type'),
    ('milestones', 'start_on'),
    ('milestones', 'end_on'),
    ('milestones', 'notes'),
    ('milestones', 'source'),
    ('project_tags', 'id'),
    ('project_tags', 'workspace_id'),
    ('project_tags', 'project_id'),
    ('project_tags', 'name'),
    ('project_tags', 'slug'),
    ('project_tags', 'origin'),
    ('item_tags', 'id'),
    ('item_tags', 'workspace_id'),
    ('item_tags', 'project_id'),
    ('item_tags', 'tag_id'),
    ('item_tags', 'target_kind'),
    ('item_tags', 'target_id'),
    ('recommendations', 'id'),
    ('recommendations', 'workspace_id'),
    ('recommendations', 'project_id'),
    ('recommendations', 'kind'),
    ('recommendations', 'urgency'),
    ('recommendations', 'title'),
    ('recommendations', 'action'),
    ('recommendations', 'why'),
    ('recommendations', 'leadership_impact'),
    ('recommendations', 'suggested_script'),
    ('recommendations', 'status'),
    ('recommendations', 'created_by'),
    ('memories', 'id'),
    ('memories', 'workspace_id'),
    ('memories', 'project_id'),
    ('memories', 'type'),
    ('memories', 'title'),
    ('memories', 'content'),
    ('memories', 'tags'),
    ('memories', 'people'),
    ('memories', 'source'),
    ('memories', 'created_by')
)
select
  'table'::text as check_kind,
  w.table_name as object_name,
  ''::text as name,
  case
    when to_regclass(format('public.%I', w.table_name)) is null then 'MISSING'
    else 'present'
  end as detail
from wanted_tables w

union all

select
  'required_column',
  r.table_name,
  r.column_name,
  case
    when exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = r.table_name
        and c.column_name = r.column_name
    ) then 'present'
    else 'MISSING'
  end
from required_columns r

union all

select
  'column',
  c.table_name,
  c.column_name,
  c.data_type
from information_schema.columns c
join wanted_tables w on w.table_name = c.table_name
where c.table_schema = 'public'

union all

select
  'function',
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  'present'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_project_bundle',
    'delete_project_bundle',
    'project_belongs_to_workspace'
  )

union all

select
  'index',
  'projects',
  'projects_workspace_code_lower_idx',
  case
    when exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'projects_workspace_code_lower_idx'
    ) then 'present'
    else 'MISSING'
  end

union all

select
  'recent_project',
  p.id::text,
  p.name,
  format('code=%s created_at=%s', p.code, p.created_at)
from public.projects p
where p.created_at > timezone('utc', now()) - interval '24 hours'

union all

select
  'leftover_children',
  p.id::text,
  p.name,
  format(
    'stakeholders=%s todos=%s risks=%s knowledge=%s milestones=%s recs=%s memories=%s',
    (select count(*) from public.stakeholders s where s.project_id = p.id),
    (select count(*) from public.todos t where t.project_id = p.id),
    (select count(*) from public.risks r where r.project_id = p.id),
    (select count(*) from public.knowledge_items k where k.project_id = p.id),
    (select count(*) from public.milestones m where m.project_id = p.id),
    (select count(*) from public.recommendations rec where rec.project_id = p.id),
    (select count(*) from public.memories mem where mem.project_id = p.id)
  )
from public.projects p
where p.created_at > timezone('utc', now()) - interval '24 hours'

order by 1, 2, 3;
