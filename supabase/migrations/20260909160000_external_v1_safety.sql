-- External V1 safety: project/workspace alignment (N-09) + atomic project-bundle delete (D-028).
-- Additive: new functions + tighter WITH CHECK. Current main still creates/deletes
-- via table inserts; those rows already name the project they just wrote, so
-- project_belongs_to_workspace does not reject legitimate current-main writes.
-- Atomic New Project create is the next migration (create_project_bundle).

create or replace function public.project_belongs_to_workspace(
  p_workspace_id uuid,
  p_project_id uuid
) returns boolean
language sql
stable
as $$
  select
    p_project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and p.workspace_id = p_workspace_id
    );
$$;

-- N-09: recommendations / history / capture_sessions must not name a foreign project.
drop policy if exists recommendations_insert_member on public.recommendations;
create policy recommendations_insert_member
  on public.recommendations for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists recommendations_update_member on public.recommendations;
create policy recommendations_update_member
  on public.recommendations for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists history_events_insert_member on public.history_events;
create policy history_events_insert_member
  on public.history_events for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists history_events_update_member on public.history_events;
create policy history_events_update_member
  on public.history_events for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists capture_sessions_insert_member on public.capture_sessions;
create policy capture_sessions_insert_member
  on public.capture_sessions for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists capture_sessions_update_member on public.capture_sessions;
create policy capture_sessions_update_member
  on public.capture_sessions for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

drop policy if exists memories_update_member on public.memories;
create policy memories_update_member
  on public.memories for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and public.project_belongs_to_workspace(workspace_id, project_id)
  );

-- D-028: one transaction removes SET NULL children then the project row.
create or replace function public.delete_project_bundle(
  p_workspace_id uuid,
  p_project_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  delete from public.todos
    where workspace_id = p_workspace_id and project_id = p_project_id;
  delete from public.memories
    where workspace_id = p_workspace_id and project_id = p_project_id;
  delete from public.recommendations
    where workspace_id = p_workspace_id and project_id = p_project_id;
  delete from public.history_events
    where workspace_id = p_workspace_id and project_id = p_project_id;
  delete from public.capture_sessions
    where workspace_id = p_workspace_id and project_id = p_project_id;
  delete from public.coach_sessions
    where workspace_id = p_workspace_id and project_id = p_project_id;

  delete from public.projects
    where id = p_project_id
      and workspace_id = p_workspace_id;
end;
$$;

revoke all on function public.delete_project_bundle(uuid, uuid) from public;
grant execute on function public.delete_project_bundle(uuid, uuid) to authenticated;
grant execute on function public.project_belongs_to_workspace(uuid, uuid) to authenticated;
