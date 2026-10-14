-- Additive Issue Notes and exact History target identity.
-- Existing rows stay valid. No backfill. No title, detail, or fuzzy attribution.
-- NULL risks.notes means no current Notes.
-- NULL history target columns stay unattributed forever.

alter table public.risks add column if not exists notes text;

alter table public.history_events add column if not exists target_kind text;

alter table public.history_events add column if not exists target_id uuid;

alter table public.history_events
  drop constraint if exists history_events_target_pair_chk;

alter table public.history_events
  add constraint history_events_target_pair_chk
  check (
    (target_kind is null and target_id is null)
    or (target_kind is not null and target_id is not null)
  );

alter table public.history_events
  drop constraint if exists history_events_target_kind_chk;

alter table public.history_events
  add constraint history_events_target_kind_chk
  check (target_kind is null or target_kind = 'risk');

create index if not exists history_events_target_idx
  on public.history_events (workspace_id, project_id, target_kind, target_id)
  where target_id is not null;

-- Notes change and its targeted History row commit together or not at all.
-- SECURITY INVOKER: RLS stays in force. Membership and project scope are
-- also checked explicitly so a foreign Issue UUID cannot be updated.
create or replace function public.set_risk_notes(
  p_workspace_id uuid,
  p_project_id uuid,
  p_risk_id uuid,
  p_notes text,
  p_created_by uuid
) returns jsonb
language plpgsql
as $$
declare
  v_row public.risks%rowtype;
  v_prev text;
  v_next text;
  v_title text;
  v_detail text;
  v_history_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and workspace_id = p_workspace_id
  ) then
    raise exception 'project is not in this workspace';
  end if;

  select *
  into v_row
  from public.risks
  where id = p_risk_id
    and project_id = p_project_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'issue is not in this project';
  end if;

  v_prev := nullif(btrim(coalesce(v_row.notes, '')), '');
  v_next := nullif(btrim(coalesce(p_notes, '')), '');

  if v_prev is not distinct from v_next then
    return jsonb_build_object(
      'ok', true,
      'changed', false,
      'notes', v_next
    );
  end if;

  if v_prev is null then
    v_title := 'Issue notes added';
  elsif v_next is null then
    v_title := 'Issue notes cleared';
  else
    v_title := 'Issue notes updated';
  end if;

  v_detail :=
    'Previous notes:' || E'\n' || coalesce(v_prev, '') ||
    E'\n' || 'Current notes:' || E'\n' || coalesce(v_next, '');

  update public.risks
  set notes = v_next
  where id = v_row.id
    and project_id = p_project_id
    and workspace_id = p_workspace_id;

  insert into public.history_events (
    workspace_id,
    project_id,
    type,
    title,
    detail,
    source,
    created_by,
    target_kind,
    target_id
  ) values (
    p_workspace_id,
    p_project_id,
    'other',
    v_title,
    v_detail,
    'user',
    p_created_by,
    'risk',
    v_row.id
  )
  returning id into v_history_id;

  return jsonb_build_object(
    'ok', true,
    'changed', true,
    'notes', v_next,
    'history_id', v_history_id,
    'history_title', v_title,
    'history_detail', v_detail
  );
end;
$$;

grant execute on function public.set_risk_notes(uuid, uuid, uuid, text, uuid) to authenticated;
