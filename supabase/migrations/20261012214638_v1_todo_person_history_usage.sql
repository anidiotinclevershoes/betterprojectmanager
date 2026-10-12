-- Additive V1 edits: To Do Waiting-on people, Person name/role, targeted History, usage count.
-- Does not rewrite todos.waiting_on, responsibilities, or existing history rows.
-- NULL history targets stay unattributed. No backfill. No name matching.

create table if not exists public.todo_waiting_people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  todo_id uuid not null references public.todos (id) on delete cascade,
  person_id uuid not null references public.stakeholders (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (todo_id, person_id)
);

create index if not exists todo_waiting_people_todo_id_idx
  on public.todo_waiting_people (todo_id);

create index if not exists todo_waiting_people_person_id_idx
  on public.todo_waiting_people (person_id);

alter table public.todo_waiting_people enable row level security;
alter table public.todo_waiting_people force row level security;

drop policy if exists todo_waiting_people_select_member on public.todo_waiting_people;
create policy todo_waiting_people_select_member
  on public.todo_waiting_people for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists todo_waiting_people_insert_member on public.todo_waiting_people;
create policy todo_waiting_people_insert_member
  on public.todo_waiting_people for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = todo_waiting_people.workspace_id
    )
    and exists (
      select 1 from public.todos t
      where t.id = todo_id
        and t.workspace_id = todo_waiting_people.workspace_id
        and t.project_id = todo_waiting_people.project_id
    )
    and exists (
      select 1 from public.stakeholders s
      where s.id = person_id
        and s.workspace_id = todo_waiting_people.workspace_id
        and s.project_id = todo_waiting_people.project_id
    )
  );

drop policy if exists todo_waiting_people_delete_member on public.todo_waiting_people;
create policy todo_waiting_people_delete_member
  on public.todo_waiting_people for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select, insert, delete on public.todo_waiting_people to authenticated, service_role;

alter table public.history_events
  drop constraint if exists history_events_target_kind_chk;

alter table public.history_events
  add constraint history_events_target_kind_chk
  check (
    target_kind is null
    or target_kind in ('risk', 'todo', 'person')
  );

-- Title, detail, due date, the legacy waiting note, and explicit person links.
-- The legacy note is stored only as the caller sent it. It is never built from names.
create or replace function public.save_todo_edit(
  p_workspace_id uuid,
  p_project_id uuid,
  p_todo_id uuid,
  p_title text,
  p_detail text,
  p_due_on date,
  p_waiting_on text,
  p_waiting_person_ids uuid[],
  p_created_by uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row public.todos%rowtype;
  v_title text;
  v_detail text;
  v_waiting text;
  v_prev_ids uuid[];
  v_next_ids uuid[];
  v_changed boolean := false;
  v_history_id uuid;
  v_detail_text text;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'project is not in this workspace';
  end if;

  select * into v_row
  from public.todos
  where id = p_todo_id
    and project_id = p_project_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'to do is not in this project';
  end if;

  v_title := nullif(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'), '');
  if v_title is null then
    raise exception 'title is required';
  end if;

  v_detail := nullif(regexp_replace(btrim(coalesce(p_detail, '')), '\s+', ' ', 'g'), '');
  v_waiting := nullif(regexp_replace(btrim(coalesce(p_waiting_on, '')), '\s+', ' ', 'g'), '');

  select coalesce(array_agg(person_id order by person_id), '{}')
    into v_prev_ids
  from public.todo_waiting_people
  where todo_id = p_todo_id
    and workspace_id = p_workspace_id;

  select coalesce(array_agg(distinct id order by id), '{}')
    into v_next_ids
  from unnest(coalesce(p_waiting_person_ids, '{}')) as incoming(id)
  where id is not null;

  if exists (
    select 1
    from unnest(v_next_ids) as wanted(id)
    where not exists (
      select 1 from public.stakeholders s
      where s.id = wanted.id
        and s.project_id = p_project_id
        and s.workspace_id = p_workspace_id
    )
  ) then
    raise exception 'waiting on can only use people already in this project';
  end if;

  if v_row.title is distinct from v_title
    or nullif(btrim(coalesce(v_row.detail, '')), '') is distinct from v_detail
    or v_row.due_on is distinct from p_due_on
    or nullif(btrim(coalesce(v_row.waiting_on, '')), '') is distinct from v_waiting
    or v_prev_ids is distinct from v_next_ids
  then
    v_changed := true;
  end if;

  if not v_changed then
    return jsonb_build_object('changed', false);
  end if;

  update public.todos
  set title = v_title,
      detail = v_detail,
      due_on = p_due_on,
      waiting_on = v_waiting
  where id = p_todo_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id;

  delete from public.todo_waiting_people
  where todo_id = p_todo_id
    and workspace_id = p_workspace_id
    and not (person_id = any(v_next_ids));

  insert into public.todo_waiting_people (workspace_id, project_id, todo_id, person_id)
  select p_workspace_id, p_project_id, p_todo_id, wanted.id
  from unnest(v_next_ids) as wanted(id)
  where not exists (
    select 1 from public.todo_waiting_people existing
    where existing.todo_id = p_todo_id
      and existing.person_id = wanted.id
  );

  v_detail_text := v_title;
  insert into public.history_events (
    workspace_id, project_id, type, title, detail, source, created_by, target_kind, target_id
  ) values (
    p_workspace_id,
    p_project_id,
    'task_updated',
    'You updated a To Do',
    v_detail_text,
    'user',
    p_created_by,
    'todo',
    p_todo_id
  )
  returning id into v_history_id;

  return jsonb_build_object('changed', true, 'historyId', v_history_id);
end;
$$;

revoke all on function public.save_todo_edit(uuid, uuid, uuid, text, text, date, text, uuid[], uuid) from public;
grant execute on function public.save_todo_edit(uuid, uuid, uuid, text, text, date, text, uuid[], uuid) to authenticated;

-- Name and role only. The person id stays. Responsibilities are not rewritten.
create or replace function public.save_person_identity(
  p_workspace_id uuid,
  p_project_id uuid,
  p_person_id uuid,
  p_name text,
  p_role text,
  p_created_by uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row public.stakeholders%rowtype;
  v_name text;
  v_role text;
  v_key text;
  v_history_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'project is not in this workspace';
  end if;

  select * into v_row
  from public.stakeholders
  where id = p_person_id
    and project_id = p_project_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'person is not in this project';
  end if;

  v_name := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  if v_name is null then
    raise exception 'name is required';
  end if;
  v_role := regexp_replace(btrim(coalesce(p_role, '')), '\s+', ' ', 'g');
  v_key := lower(v_name);

  if lower(regexp_replace(btrim(v_row.name), '\s+', ' ', 'g')) is distinct from v_key
    and exists (
      select 1 from public.stakeholders other
      where other.project_id = p_project_id
        and other.workspace_id = p_workspace_id
        and other.id <> p_person_id
        and lower(regexp_replace(btrim(other.name), '\s+', ' ', 'g')) = v_key
    )
  then
    raise exception 'another person in this project already uses that name';
  end if;

  if v_row.name is not distinct from v_name
    and regexp_replace(btrim(coalesce(v_row.role, '')), '\s+', ' ', 'g') is not distinct from v_role
  then
    return jsonb_build_object('changed', false);
  end if;

  update public.stakeholders
  set name = v_name,
      role = v_role
  where id = p_person_id
    and workspace_id = p_workspace_id
    and project_id = p_project_id;

  insert into public.history_events (
    workspace_id, project_id, type, title, detail, source, created_by, target_kind, target_id
  ) values (
    p_workspace_id,
    p_project_id,
    'other',
    'You updated a person',
    v_name,
    'user',
    p_created_by,
    'person',
    p_person_id
  )
  returning id into v_history_id;

  return jsonb_build_object('changed', true, 'historyId', v_history_id, 'name', v_name, 'role', v_role);
end;
$$;

revoke all on function public.save_person_identity(uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.save_person_identity(uuid, uuid, uuid, text, text, uuid) to authenticated;

-- Counts a completed analysis on the existing workspace_usage row.
-- Does not decide a price, a plan, or whether the caller may continue.
create or replace function public.record_workspace_analysis(p_workspace_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_key text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_used integer;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  insert into public.workspace_usage as usage (
    workspace_id, analyses_this_month, analyses_month_key, last_analyzed_at
  ) values (
    p_workspace_id, 1, v_key, timezone('utc', now())
  )
  on conflict (workspace_id) do update
  set analyses_this_month = case
        when usage.analyses_month_key is distinct from excluded.analyses_month_key then 1
        else usage.analyses_this_month + 1
      end,
      analyses_month_key = excluded.analyses_month_key,
      last_analyzed_at = excluded.last_analyzed_at
  returning analyses_this_month into v_used;

  return jsonb_build_object('used', v_used, 'monthKey', v_key);
end;
$$;

revoke all on function public.record_workspace_analysis(uuid) from public;
grant execute on function public.record_workspace_analysis(uuid) to authenticated;
