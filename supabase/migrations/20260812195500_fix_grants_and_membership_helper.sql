-- Patch for projects that already ran the Phase 1 schema + RLS migrations.
-- Fixes: "permission denied for table workspace_members" under the anon/authenticated API role,
-- and membership helper recursion under FORCE RLS.

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

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

  insert into public.workspaces (name)
  values (display || '''s workspace')
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

create or replace function public.create_workspace_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  ws_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workspaces (name)
  values (coalesce(nullif(trim(p_name), ''), 'My workspace'))
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  insert into public.workspace_usage (workspace_id)
  values (ws_id)
  on conflict (workspace_id) do nothing;

  return ws_id;
end;
$$;

revoke all on function public.create_workspace_with_owner(text) from public;
grant execute on function public.create_workspace_with_owner(text) to authenticated;

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
  on public.workspace_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.stakeholders,
  public.todos,
  public.risks,
  public.knowledge_items,
  public.milestones,
  public.memories,
  public.recommendations,
  public.meetings,
  public.releases,
  public.capture_sessions,
  public.history_events,
  public.coach_sessions,
  public.workspace_preferences,
  public.workspace_usage
to authenticated, service_role;
