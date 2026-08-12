-- Lume Phase 1: Row Level Security — workspace membership isolation
-- A user may access data only for workspaces where they are a member.

-- Enable RLS on every owned table
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.stakeholders enable row level security;
alter table public.todos enable row level security;
alter table public.risks enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.milestones enable row level security;
alter table public.memories enable row level security;
alter table public.recommendations enable row level security;
alter table public.meetings enable row level security;
alter table public.releases enable row level security;
alter table public.capture_sessions enable row level security;
alter table public.history_events enable row level security;
alter table public.coach_sessions enable row level security;
alter table public.workspace_preferences enable row level security;
alter table public.workspace_usage enable row level security;

-- Force RLS for table owners too (defense in depth)
alter table public.profiles force row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members force row level security;
alter table public.projects force row level security;
alter table public.stakeholders force row level security;
alter table public.todos force row level security;
alter table public.risks force row level security;
alter table public.knowledge_items force row level security;
alter table public.milestones force row level security;
alter table public.memories force row level security;
alter table public.recommendations force row level security;
alter table public.meetings force row level security;
alter table public.releases force row level security;
alter table public.capture_sessions force row level security;
alter table public.history_events force row level security;
alter table public.coach_sessions force row level security;
alter table public.workspace_preferences force row level security;
alter table public.workspace_usage force row level security;

-- ---------------------------------------------------------------------------
-- Profiles: users can read/update their own profile
-- ---------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Workspaces: members can read; owners can update
-- ---------------------------------------------------------------------------
create policy workspaces_select_member
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

-- Direct inserts into workspaces are not used by the app.
-- Use public.create_workspace_with_owner(name) (security definer) instead.
-- No INSERT policy for authenticated on workspaces → denied by default under RLS.

create policy workspaces_update_member
  on public.workspaces for update
  to authenticated
  using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

-- No broad delete — workspace deletion is deferred / owner-only later
create policy workspaces_delete_owner
  on public.workspaces for delete
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Workspace members
-- ---------------------------------------------------------------------------
-- Users can always read their own membership rows (needed to list workspaces).
-- They can also read fellow members of workspaces they belong to.
create policy workspace_members_select_member
  on public.workspace_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

-- Only existing owners may add members (bootstrap uses security definer functions)
create policy workspace_members_insert_owner
  on public.workspace_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

create policy workspace_members_update_owner
  on public.workspace_members for update
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

create policy workspace_members_delete_owner
  on public.workspace_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Generic workspace-scoped policies for project entities
-- Pattern: SELECT/UPDATE/DELETE require membership;
-- INSERT requires membership AND (when project_id set) project in same workspace.
-- ---------------------------------------------------------------------------

-- Projects
create policy projects_select_member
  on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy projects_insert_member
  on public.projects for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy projects_update_member
  on public.projects for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy projects_delete_member
  on public.projects for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Helper expression reused conceptually for child inserts:
-- public.is_workspace_member(workspace_id)
-- AND (project_id is null OR exists project with same workspace_id)

-- Stakeholders
create policy stakeholders_select_member
  on public.stakeholders for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy stakeholders_insert_member
  on public.stakeholders for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = stakeholders.workspace_id
    )
  );

create policy stakeholders_update_member
  on public.stakeholders for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = stakeholders.workspace_id
    )
  );

create policy stakeholders_delete_member
  on public.stakeholders for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Todos
create policy todos_select_member
  on public.todos for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy todos_insert_member
  on public.todos for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.workspace_id = todos.workspace_id
      )
    )
  );

create policy todos_update_member
  on public.todos for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.workspace_id = todos.workspace_id
      )
    )
  );

create policy todos_delete_member
  on public.todos for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Risks
create policy risks_select_member
  on public.risks for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy risks_insert_member
  on public.risks for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = risks.workspace_id
    )
  );

create policy risks_update_member
  on public.risks for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = risks.workspace_id
    )
  );

create policy risks_delete_member
  on public.risks for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Knowledge items
create policy knowledge_items_select_member
  on public.knowledge_items for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy knowledge_items_insert_member
  on public.knowledge_items for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = knowledge_items.workspace_id
    )
  );

create policy knowledge_items_update_member
  on public.knowledge_items for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = knowledge_items.workspace_id
    )
  );

create policy knowledge_items_delete_member
  on public.knowledge_items for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Milestones
create policy milestones_select_member
  on public.milestones for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy milestones_insert_member
  on public.milestones for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = milestones.workspace_id
    )
  );

create policy milestones_update_member
  on public.milestones for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = milestones.workspace_id
    )
  );

create policy milestones_delete_member
  on public.milestones for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Memories
create policy memories_select_member
  on public.memories for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy memories_insert_member
  on public.memories for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.workspace_id = memories.workspace_id
      )
    )
  );

create policy memories_update_member
  on public.memories for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy memories_delete_member
  on public.memories for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Recommendations
create policy recommendations_select_member
  on public.recommendations for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy recommendations_insert_member
  on public.recommendations for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy recommendations_update_member
  on public.recommendations for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy recommendations_delete_member
  on public.recommendations for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Meetings
create policy meetings_select_member
  on public.meetings for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy meetings_insert_member
  on public.meetings for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = meetings.workspace_id
    )
  );

create policy meetings_update_member
  on public.meetings for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy meetings_delete_member
  on public.meetings for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Releases
create policy releases_select_member
  on public.releases for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy releases_insert_member
  on public.releases for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = releases.workspace_id
    )
  );

create policy releases_update_member
  on public.releases for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy releases_delete_member
  on public.releases for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Capture sessions
create policy capture_sessions_select_member
  on public.capture_sessions for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy capture_sessions_insert_member
  on public.capture_sessions for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy capture_sessions_update_member
  on public.capture_sessions for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy capture_sessions_delete_member
  on public.capture_sessions for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- History events
create policy history_events_select_member
  on public.history_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy history_events_insert_member
  on public.history_events for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy history_events_update_member
  on public.history_events for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy history_events_delete_member
  on public.history_events for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Coach sessions
create policy coach_sessions_select_member
  on public.coach_sessions for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy coach_sessions_insert_member
  on public.coach_sessions for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy coach_sessions_update_member
  on public.coach_sessions for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy coach_sessions_delete_member
  on public.coach_sessions for delete to authenticated
  using (public.is_workspace_member(workspace_id));

-- Workspace preferences (own rows within member workspaces)
create policy workspace_preferences_select_own
  on public.workspace_preferences for select to authenticated
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

create policy workspace_preferences_insert_own
  on public.workspace_preferences for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

create policy workspace_preferences_update_own
  on public.workspace_preferences for update to authenticated
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

create policy workspace_preferences_delete_own
  on public.workspace_preferences for delete to authenticated
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

-- Workspace usage
create policy workspace_usage_select_member
  on public.workspace_usage for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy workspace_usage_insert_member
  on public.workspace_usage for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy workspace_usage_update_member
  on public.workspace_usage for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy workspace_usage_delete_member
  on public.workspace_usage for delete to authenticated
  using (public.is_workspace_member(workspace_id));
