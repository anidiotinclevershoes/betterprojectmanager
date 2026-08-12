-- Phase 2: idempotent personal workspace helper + consistent naming on signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  ws_id uuid;
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'Lume user'
  );

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, display)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  -- Only create a personal workspace if the user has none yet
  if not exists (
    select 1 from public.workspace_members m where m.user_id = new.id
  ) then
    insert into public.workspaces (name)
    values ('Personal Lume Workspace')
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');

    insert into public.workspace_usage (workspace_id)
    values (ws_id)
    on conflict (workspace_id) do nothing;
  end if;

  return new;
end;
$$;

-- Idempotent: return existing ownership workspace or create Personal Lume Workspace.
create or replace function public.ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  ws_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.workspace_id into ws_id
  from public.workspace_members m
  where m.user_id = uid
  order by case when m.role = 'owner' then 0 else 1 end, m.created_at asc
  limit 1;

  if ws_id is not null then
    return ws_id;
  end if;

  insert into public.workspaces (name)
  values ('Personal Lume Workspace')
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  insert into public.workspace_usage (workspace_id)
  values (ws_id)
  on conflict (workspace_id) do nothing;

  return ws_id;
end;
$$;

revoke all on function public.ensure_personal_workspace() from public;
grant execute on function public.ensure_personal_workspace() to authenticated;
