-- D-028: one transaction creates the New Project canonical bundle.
-- Additive. Current main does not call this function, so applying it first
-- cannot break live create/delete. New code must not deploy until this exists.

create or replace function public.create_project_bundle(
  p_workspace_id uuid,
  p_created_by uuid,
  p_project jsonb,
  p_stakeholders jsonb default '[]'::jsonb,
  p_todos jsonb default '[]'::jsonb,
  p_risks jsonb default '[]'::jsonb,
  p_knowledge jsonb default '[]'::jsonb,
  p_milestones jsonb default '[]'::jsonb,
  p_recommendations jsonb default '[]'::jsonb,
  p_project_tags jsonb default '[]'::jsonb,
  p_item_tags jsonb default '[]'::jsonb,
  p_memory jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  if p_project is null or coalesce(p_project->>'name', '') = '' then
    raise exception 'project payload required';
  end if;

  v_project_id := coalesce(nullif(p_project->>'id', '')::uuid, gen_random_uuid());

  insert into public.projects (
    id, workspace_id, name, code, summary, status, kind,
    current_focus, next_milestone, next_milestone_on, created_by
  ) values (
    v_project_id,
    p_workspace_id,
    p_project->>'name',
    p_project->>'code',
    coalesce(p_project->>'summary', ''),
    coalesce(nullif(p_project->>'status', ''), 'healthy'),
    coalesce(nullif(p_project->>'kind', ''), 'delivery'),
    coalesce(p_project->>'current_focus', ''),
    nullif(p_project->>'next_milestone', ''),
    nullif(p_project->>'next_milestone_on', '')::date,
    p_created_by
  );

  insert into public.stakeholders (
    id, workspace_id, project_id, name, role, preferences, concerns
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'name',
    coalesce(nullif(elem->>'role', ''), 'Stakeholder'),
    coalesce(elem->'preferences', '[]'::jsonb),
    coalesce(elem->'concerns', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_stakeholders, '[]'::jsonb)) as elem
  where coalesce(elem->>'name', '') <> '';

  insert into public.todos (
    id, workspace_id, project_id, title, detail, done, due_on, kind,
    waiting_on, created_by
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'title',
    nullif(elem->>'detail', ''),
    coalesce((elem->>'done')::boolean, false),
    nullif(elem->>'due_on', '')::date,
    coalesce(nullif(elem->>'kind', ''), 'ACTION'),
    nullif(elem->>'waiting_on', ''),
    p_created_by
  from jsonb_array_elements(coalesce(p_todos, '[]'::jsonb)) as elem
  where coalesce(elem->>'title', '') <> '';

  insert into public.risks (
    id, workspace_id, project_id, title, status, source, created_by
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'title',
    coalesce(nullif(elem->>'status', ''), 'open'),
    coalesce(nullif(elem->>'source', ''), 'manual'),
    p_created_by
  from jsonb_array_elements(coalesce(p_risks, '[]'::jsonb)) as elem
  where coalesce(elem->>'title', '') <> '';

  insert into public.knowledge_items (
    id, workspace_id, project_id, section, body, position, created_by,
    kind, epistemic, lifecycle, supersedes_id, meta, provenance
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    coalesce(nullif(elem->>'section', ''), 'now'),
    elem->>'body',
    coalesce((elem->>'position')::int, 0),
    p_created_by,
    elem->>'kind',
    elem->>'epistemic',
    coalesce(nullif(elem->>'lifecycle', ''), 'current'),
    nullif(elem->>'supersedes_id', '')::uuid,
    coalesce(elem->'meta', '{}'::jsonb),
    coalesce(elem->'provenance', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_knowledge, '[]'::jsonb)) as elem
  where coalesce(elem->>'body', '') <> '';

  insert into public.milestones (
    id, workspace_id, project_id, label, type, start_on, end_on, notes, source
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'label',
    coalesce(nullif(elem->>'type', ''), 'milestone'),
    (elem->>'start_on')::date,
    nullif(elem->>'end_on', '')::date,
    nullif(elem->>'notes', ''),
    coalesce(nullif(elem->>'source', ''), 'manual')
  from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb)) as elem
  where coalesce(elem->>'label', '') <> ''
    and coalesce(elem->>'start_on', '') <> '';

  insert into public.project_tags (
    id, workspace_id, project_id, name, slug, origin
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'name',
    elem->>'slug',
    coalesce(nullif(elem->>'origin', ''), 'custom')
  from jsonb_array_elements(coalesce(p_project_tags, '[]'::jsonb)) as elem
  where coalesce(elem->>'slug', '') <> '';

  insert into public.item_tags (
    id, workspace_id, project_id, tag_id, target_kind, target_id
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    (elem->>'tag_id')::uuid,
    elem->>'target_kind',
    (elem->>'target_id')::uuid
  from jsonb_array_elements(coalesce(p_item_tags, '[]'::jsonb)) as elem
  where coalesce(elem->>'tag_id', '') <> ''
    and coalesce(elem->>'target_id', '') <> '';

  insert into public.recommendations (
    id, workspace_id, project_id, kind, urgency, title, action, why,
    leadership_impact, suggested_script, status, created_by
  )
  select
    coalesce(nullif(elem->>'id', '')::uuid, gen_random_uuid()),
    p_workspace_id,
    v_project_id,
    elem->>'kind',
    coalesce(nullif(elem->>'urgency', ''), 'this_week'),
    elem->>'title',
    coalesce(elem->>'action', ''),
    coalesce(elem->>'why', ''),
    coalesce(elem->>'leadership_impact', ''),
    nullif(elem->>'suggested_script', ''),
    coalesce(nullif(elem->>'status', ''), 'active'),
    p_created_by
  from jsonb_array_elements(coalesce(p_recommendations, '[]'::jsonb)) as elem
  where coalesce(elem->>'title', '') <> '';

  if p_memory is not null and coalesce(p_memory->>'title', '') <> '' then
    insert into public.memories (
      id, workspace_id, project_id, type, title, content, tags, people,
      source, created_by
    ) values (
      coalesce(nullif(p_memory->>'id', '')::uuid, gen_random_uuid()),
      p_workspace_id,
      v_project_id,
      coalesce(nullif(p_memory->>'type', ''), 'conversation'),
      p_memory->>'title',
      coalesce(p_memory->>'content', ''),
      coalesce(p_memory->'tags', '[]'::jsonb),
      coalesce(p_memory->'people', '[]'::jsonb),
      coalesce(nullif(p_memory->>'source', ''), 'capture'),
      p_created_by
    );
  end if;

  return jsonb_build_object('project_id', v_project_id);
end;
$$;

revoke all on function public.create_project_bundle(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_project_bundle(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
