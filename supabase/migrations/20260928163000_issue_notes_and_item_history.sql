-- Issue edit foundation: nullable Notes + deterministic item History attribution.
-- Additive/backwards-compatible: existing risks/history rows remain valid.

alter table public.risks
  add column if not exists notes text;

alter table public.history_events
  add column if not exists target_kind text,
  add column if not exists target_id text;

create index if not exists history_events_item_target_idx
  on public.history_events (
    workspace_id,
    project_id,
    target_kind,
    target_id,
    created_at desc
  )
  where target_id is not null;

-- Canonical Issue title/notes edit and its audit row are one transaction.
-- security invoker keeps the existing risks/history RLS policies authoritative.
create or replace function public.update_risk_with_history(
  p_workspace_id uuid,
  p_project_id uuid,
  p_risk_id uuid,
  p_title text,
  p_notes text,
  p_history_title text,
  p_history_detail text,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before public.risks%rowtype;
  v_after public.risks%rowtype;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;
  if not public.project_belongs_to_workspace(p_workspace_id, p_project_id) then
    raise exception 'project is not in workspace';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'issue title cannot be empty';
  end if;

  select *
    into v_before
    from public.risks
   where id = p_risk_id
     and workspace_id = p_workspace_id
     and project_id = p_project_id
   for update;

  if not found then
    raise exception 'issue not found in project';
  end if;

  update public.risks
     set title = btrim(p_title),
         notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_risk_id
     and workspace_id = p_workspace_id
     and project_id = p_project_id
  returning * into v_after;

  if v_before.title is distinct from v_after.title then
    update public.knowledge_items
       set body = v_after.title
     where workspace_id = p_workspace_id
       and project_id = p_project_id
       and section = 'risks'
       and lifecycle = 'current'
       and lower(btrim(body)) = lower(btrim(v_before.title));
  end if;

  insert into public.history_events (
    workspace_id, project_id, type, title, detail,
    target_kind, target_id, source, created_by
  ) values (
    p_workspace_id, p_project_id, 'risk_updated',
    coalesce(nullif(btrim(p_history_title), ''), 'Issue updated'),
    p_history_detail, 'risk', p_risk_id::text, 'user', p_created_by
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.set_risk_status_with_history(
  p_workspace_id uuid,
  p_project_id uuid,
  p_risk_id uuid,
  p_status text,
  p_history_title text,
  p_history_detail text,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_after public.risks%rowtype;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;
  if not public.project_belongs_to_workspace(p_workspace_id, p_project_id) then
    raise exception 'project is not in workspace';
  end if;
  if p_status not in ('open', 'watch', 'resolved', 'accepted') then
    raise exception 'invalid issue status';
  end if;

  update public.risks
     set status = p_status
   where id = p_risk_id
     and workspace_id = p_workspace_id
     and project_id = p_project_id
  returning * into v_after;

  if not found then
    raise exception 'issue not found in project';
  end if;

  insert into public.history_events (
    workspace_id, project_id, type, title, detail,
    target_kind, target_id, source, created_by
  ) values (
    p_workspace_id, p_project_id, 'risk_updated',
    coalesce(nullif(btrim(p_history_title), ''), 'Issue updated'),
    p_history_detail, 'risk', p_risk_id::text, 'user', p_created_by
  );

  return to_jsonb(v_after);
end;
$$;

revoke all on function public.update_risk_with_history(
  uuid, uuid, uuid, text, text, text, text, uuid
) from public;
grant execute on function public.update_risk_with_history(
  uuid, uuid, uuid, text, text, text, text, uuid
) to authenticated;

revoke all on function public.set_risk_status_with_history(
  uuid, uuid, uuid, text, text, text, uuid
) from public;
grant execute on function public.set_risk_status_with_history(
  uuid, uuid, uuid, text, text, text, uuid
) to authenticated;
