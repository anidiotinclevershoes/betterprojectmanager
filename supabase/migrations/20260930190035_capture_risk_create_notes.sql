-- Carry explicit Capture risk notes onto the existing risks.notes column.
-- Same function signature. Notes are optional. Absent notes stay NULL.
-- No new table, no backfill, no change to receipt identity.

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
    id, workspace_id, project_id, title, status, source, created_by, notes
  ) values (
    v_risk_id,
    p_workspace_id,
    p_project_id,
    p_risk->>'title',
    coalesce(p_risk->>'status', 'open'),
    coalesce(p_risk->>'source', 'capture'),
    nullif(p_risk->>'created_by', '')::uuid,
    nullif(btrim(coalesce(p_risk->>'notes', '')), '')
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
