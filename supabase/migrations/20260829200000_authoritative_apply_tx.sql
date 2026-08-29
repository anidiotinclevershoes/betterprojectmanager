-- Tiny transaction boundaries for Capture Apply multi-row writes.
-- History stays outside these functions.
-- Compensation-of-compensation is not a substitute for atomic persist.

create or replace function public.persist_risk_with_knowledge(
  p_workspace_id uuid,
  p_project_id uuid,
  p_knowledge jsonb,
  p_risk jsonb,
  p_receipt jsonb default null
) returns jsonb
language plpgsql
as $$
declare
  v_knowledge_id uuid;
  v_risk_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  v_knowledge_id := coalesce(nullif(p_knowledge->>'id', '')::uuid, gen_random_uuid());
  v_risk_id := coalesce(nullif(p_risk->>'id', '')::uuid, gen_random_uuid());

  insert into public.knowledge_items (
    id, workspace_id, project_id, section, body, position, created_by,
    kind, epistemic, lifecycle, supersedes_id, meta, provenance
  ) values (
    v_knowledge_id,
    p_workspace_id,
    p_project_id,
    coalesce(p_knowledge->>'section', 'risks'),
    p_knowledge->>'body',
    coalesce((p_knowledge->>'position')::int, 0),
    nullif(p_knowledge->>'created_by', '')::uuid,
    p_knowledge->>'kind',
    p_knowledge->>'epistemic',
    coalesce(nullif(p_knowledge->>'lifecycle', ''), 'current'),
    nullif(p_knowledge->>'supersedes_id', '')::uuid,
    coalesce(p_knowledge->'meta', '{}'::jsonb),
    coalesce(p_knowledge->'provenance', '[]'::jsonb)
  );

  insert into public.risks (
    id, workspace_id, project_id, title, status, source, created_by
  ) values (
    v_risk_id,
    p_workspace_id,
    p_project_id,
    p_risk->>'title',
    coalesce(p_risk->>'status', 'open'),
    coalesce(p_risk->>'source', 'capture'),
    nullif(p_risk->>'created_by', '')::uuid
  );

  if p_receipt is not null then
    insert into public.capture_apply_receipts (
      workspace_id, project_id, operation_id, entity_type, entity_id
    ) values (
      p_workspace_id,
      p_project_id,
      p_receipt->>'operation_id',
      coalesce(p_receipt->>'entity_type', 'risk'),
      coalesce(nullif(p_receipt->>'entity_id', ''), v_risk_id::text)
    );
  end if;

  return jsonb_build_object(
    'knowledge_id', v_knowledge_id,
    'risk_id', v_risk_id
  );
end;
$$;

create or replace function public.persist_todo_create_with_receipt(
  p_workspace_id uuid,
  p_project_id uuid,
  p_todo jsonb,
  p_receipt jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_todo_id uuid;
  v_row public.todos%rowtype;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  v_todo_id := coalesce(nullif(p_todo->>'id', '')::uuid, gen_random_uuid());

  insert into public.todos (
    id, workspace_id, project_id, title, detail, done, due_on, kind,
    waiting_on, created_by
  ) values (
    v_todo_id,
    p_workspace_id,
    p_project_id,
    p_todo->>'title',
    p_todo->>'detail',
    coalesce((p_todo->>'done')::boolean, false),
    nullif(p_todo->>'due_on', '')::date,
    coalesce(p_todo->>'kind', 'ACTION'),
    p_todo->>'waiting_on',
    nullif(p_todo->>'created_by', '')::uuid
  )
  returning * into v_row;

  insert into public.capture_apply_receipts (
    workspace_id, project_id, operation_id, entity_type, entity_id
  ) values (
    p_workspace_id,
    p_project_id,
    p_receipt->>'operation_id',
    coalesce(p_receipt->>'entity_type', 'todo'),
    coalesce(nullif(p_receipt->>'entity_id', ''), v_todo_id::text)
  );

  return jsonb_build_object(
    'id', v_row.id,
    'project_id', v_row.project_id,
    'title', v_row.title,
    'detail', v_row.detail,
    'done', v_row.done,
    'due_on', v_row.due_on,
    'kind', v_row.kind,
    'waiting_on', v_row.waiting_on,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.persist_milestone_create_with_receipt(
  p_workspace_id uuid,
  p_project_id uuid,
  p_milestone jsonb,
  p_receipt jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_row public.milestones%rowtype;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  v_id := coalesce(nullif(p_milestone->>'id', '')::uuid, gen_random_uuid());

  insert into public.milestones (
    id, workspace_id, project_id, label, type, start_on, end_on, notes, source
  ) values (
    v_id,
    p_workspace_id,
    p_project_id,
    p_milestone->>'label',
    coalesce(p_milestone->>'type', 'milestone'),
    (p_milestone->>'start_on')::date,
    nullif(p_milestone->>'end_on', '')::date,
    p_milestone->>'notes',
    coalesce(p_milestone->>'source', 'capture')
  )
  returning * into v_row;

  insert into public.capture_apply_receipts (
    workspace_id, project_id, operation_id, entity_type, entity_id
  ) values (
    p_workspace_id,
    p_project_id,
    p_receipt->>'operation_id',
    coalesce(p_receipt->>'entity_type', 'milestone'),
    coalesce(nullif(p_receipt->>'entity_id', ''), v_id::text)
  );

  return jsonb_build_object(
    'id', v_row.id,
    'project_id', v_row.project_id,
    'label', v_row.label,
    'type', v_row.type,
    'start_on', v_row.start_on,
    'end_on', v_row.end_on,
    'notes', v_row.notes,
    'source', v_row.source,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.persist_person_responsibility(
  p_workspace_id uuid,
  p_project_id uuid,
  p_stakeholder jsonb,
  p_supersede_ids uuid[] default '{}',
  p_knowledge jsonb default null
) returns jsonb
language plpgsql
as $$
declare
  v_person_id uuid;
  v_existing_id uuid;
  v_name text;
  v_created boolean := false;
  v_knowledge_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  v_person_id := (p_stakeholder->>'id')::uuid;
  v_name := btrim(p_stakeholder->>'name');

  select s.id into v_existing_id
  from public.stakeholders s
  where s.workspace_id = p_workspace_id
    and s.project_id = p_project_id
    and s.id = v_person_id
  limit 1;

  if v_existing_id is null then
    select s.id into v_existing_id
    from public.stakeholders s
    where s.workspace_id = p_workspace_id
      and s.project_id = p_project_id
      and lower(btrim(s.name)) = lower(v_name)
    limit 1;
  end if;

  if v_existing_id is null then
    insert into public.stakeholders (
      id, workspace_id, project_id, name, role
    ) values (
      v_person_id,
      p_workspace_id,
      p_project_id,
      v_name,
      coalesce(nullif(btrim(p_stakeholder->>'role'), ''), 'Stakeholder')
    );
    v_created := true;
  else
    v_person_id := v_existing_id;
  end if;

  if p_supersede_ids is not null and array_length(p_supersede_ids, 1) is not null then
    update public.knowledge_items
    set lifecycle = 'superseded'
    where workspace_id = p_workspace_id
      and project_id = p_project_id
      and id = any (p_supersede_ids);
  end if;

  if p_knowledge is not null then
    v_knowledge_id := coalesce(nullif(p_knowledge->>'id', '')::uuid, gen_random_uuid());
    insert into public.knowledge_items (
      id, workspace_id, project_id, section, body, position, created_by,
      kind, epistemic, lifecycle, supersedes_id, meta, provenance
    ) values (
      v_knowledge_id,
      p_workspace_id,
      p_project_id,
      coalesce(p_knowledge->>'section', 'people'),
      p_knowledge->>'body',
      coalesce((p_knowledge->>'position')::int, 0),
      nullif(p_knowledge->>'created_by', '')::uuid,
      p_knowledge->>'kind',
      p_knowledge->>'epistemic',
      coalesce(nullif(p_knowledge->>'lifecycle', ''), 'current'),
      nullif(p_knowledge->>'supersedes_id', '')::uuid,
      coalesce(p_knowledge->'meta', '{}'::jsonb),
      coalesce(p_knowledge->'provenance', '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'person_id', v_person_id,
    'created', v_created,
    'knowledge_id', v_knowledge_id
  );
end;
$$;

grant execute on function public.persist_risk_with_knowledge(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.persist_todo_create_with_receipt(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.persist_milestone_create_with_receipt(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.persist_person_responsibility(uuid, uuid, jsonb, uuid[], jsonb) to authenticated;
