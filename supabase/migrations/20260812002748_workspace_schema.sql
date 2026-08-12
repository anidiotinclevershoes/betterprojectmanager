-- Lume Phase 1: workspace-owned production schema
-- Reconstructable via Supabase migrations. No demo seed data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workspaces + membership
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Membership helper used by RLS
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

-- Auto-create profile + personal workspace on signup (foundation for Phase 2 auth UX)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  code text not null,
  summary text not null default '',
  status text not null default 'healthy'
    check (status in ('healthy', 'watch', 'at_risk')),
  kind text not null default 'delivery'
    check (kind in ('delivery', 'release_ops')),
  current_focus text not null default '',
  next_milestone text,
  next_milestone_on date,
  release_month text,
  merge_on date,
  release_on date,
  is_template boolean not null default false,
  cloned_from_id uuid references public.projects (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index projects_workspace_id_idx on public.projects (workspace_id);
create index projects_workspace_status_idx on public.projects (workspace_id, status);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Stakeholders
-- ---------------------------------------------------------------------------
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  role text not null default 'Stakeholder',
  preferences jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  last_contact_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index stakeholders_project_id_idx on public.stakeholders (project_id);
create index stakeholders_workspace_id_idx on public.stakeholders (workspace_id);

create trigger stakeholders_set_updated_at
before update on public.stakeholders
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- To Dos
-- ---------------------------------------------------------------------------
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  detail text,
  done boolean not null default false,
  due_on date,
  kind text not null default 'ACTION'
    check (kind in ('ACTION', 'WAITING', 'CHASE', 'REMINDER')),
  waiting_on text,
  source_recommendation_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index todos_workspace_id_idx on public.todos (workspace_id);
create index todos_project_id_idx on public.todos (project_id);
create index todos_workspace_done_idx on public.todos (workspace_id, done);

create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Risks (first-class; Risk frame)
-- ---------------------------------------------------------------------------
create table public.risks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'watch', 'resolved', 'accepted')),
  source text not null default 'manual'
    check (source in ('manual', 'capture', 'seed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index risks_workspace_id_idx on public.risks (workspace_id);
create index risks_project_id_idx on public.risks (project_id);
create index risks_workspace_status_idx on public.risks (workspace_id, status);

create trigger risks_set_updated_at
before update on public.risks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Knowledge items (durable memory bullets)
-- ---------------------------------------------------------------------------
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  section text not null
    check (section in ('now', 'decisions', 'risks', 'people', 'openLoops')),
  body text not null,
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index knowledge_items_project_id_idx on public.knowledge_items (project_id);
create index knowledge_items_workspace_id_idx on public.knowledge_items (workspace_id);
create index knowledge_items_project_section_idx
  on public.knowledge_items (project_id, section, position);

create trigger knowledge_items_set_updated_at
before update on public.knowledge_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Milestones / timeline (business dates as date)
-- ---------------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  type text not null default 'milestone'
    check (type in ('phase', 'milestone', 'meeting', 'deadline', 'submission')),
  start_on date not null,
  end_on date,
  notes text,
  source text not null default 'manual'
    check (source in ('seed', 'capture', 'manual')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index milestones_workspace_id_idx on public.milestones (workspace_id);
create index milestones_project_id_idx on public.milestones (project_id);
create index milestones_project_start_on_idx on public.milestones (project_id, start_on);

create trigger milestones_set_updated_at
before update on public.milestones
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memories
-- ---------------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  type text not null,
  title text not null,
  content text not null default '',
  tags jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  source text not null default 'system'
    check (source in ('capture', 'meeting', 'system', 'release', 'import')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index memories_workspace_id_idx on public.memories (workspace_id);
create index memories_project_id_idx on public.memories (project_id);

create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recommendations
-- ---------------------------------------------------------------------------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  kind text not null,
  urgency text not null default 'this_week'
    check (urgency in ('now', 'today', 'this_week', 'watch')),
  title text not null,
  action text not null default '',
  why text not null default '',
  leadership_impact text not null default '',
  related_memory_ids jsonb not null default '[]'::jsonb,
  suggested_script text,
  status text not null default 'active'
    check (status in ('active', 'done', 'dismissed')),
  operation text,
  item_type text,
  target_title text,
  source_finding_id text,
  proposed_operation_id text,
  confidence numeric,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recommendations_workspace_id_idx on public.recommendations (workspace_id);
create index recommendations_project_id_idx on public.recommendations (project_id);
create index recommendations_workspace_status_idx
  on public.recommendations (workspace_id, status);

create trigger recommendations_set_updated_at
before update on public.recommendations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Meetings (prep nested as jsonb — preserve domain shape)
-- ---------------------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  attendees jsonb not null default '[]'::jsonb,
  phase text not null default 'upcoming'
    check (phase in ('upcoming', 'in_progress', 'completed')),
  prep jsonb not null default '{}'::jsonb,
  during_prompts jsonb not null default '[]'::jsonb,
  debrief jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index meetings_workspace_id_idx on public.meetings (workspace_id);
create index meetings_project_id_idx on public.meetings (project_id);
create index meetings_starts_at_idx on public.meetings (starts_at);

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Releases
-- ---------------------------------------------------------------------------
create table public.releases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  target_on date,
  current_stage text not null,
  stages jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index releases_workspace_id_idx on public.releases (workspace_id);
create index releases_project_id_idx on public.releases (project_id);

create trigger releases_set_updated_at
before update on public.releases
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Capture sessions (source + structured result; no chain-of-thought)
-- ---------------------------------------------------------------------------
create table public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  source text not null default 'typed'
    check (source in ('typed', 'recorded', 'uploaded', 'pasted')),
  transcript text not null default '',
  result jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  dismissed jsonb not null default '{}'::jsonb,
  added jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  context_manifest jsonb,
  analysed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index capture_sessions_workspace_id_idx on public.capture_sessions (workspace_id);
create index capture_sessions_project_id_idx on public.capture_sessions (project_id);
create index capture_sessions_created_at_idx on public.capture_sessions (created_at desc);

create trigger capture_sessions_set_updated_at
before update on public.capture_sessions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- History events
-- ---------------------------------------------------------------------------
create table public.history_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  type text not null,
  title text not null,
  detail text,
  source text
    check (source is null or source in ('user', 'ai', 'system')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index history_events_workspace_id_idx on public.history_events (workspace_id);
create index history_events_project_id_idx on public.history_events (project_id);
create index history_events_created_at_idx on public.history_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Coach sessions
-- ---------------------------------------------------------------------------
create table public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  scope text not null default 'workspace',
  title text not null default 'Coaching session',
  markdown text not null default '',
  provider text not null default 'local',
  recommendation_states jsonb not null default '{}'::jsonb,
  status text not null default 'complete',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index coach_sessions_workspace_id_idx on public.coach_sessions (workspace_id);
create index coach_sessions_project_id_idx on public.coach_sessions (project_id);
create index coach_sessions_created_at_idx on public.coach_sessions (created_at desc);

create trigger coach_sessions_set_updated_at
before update on public.coach_sessions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workspace preferences (layouts etc.) — optional sync later
-- ---------------------------------------------------------------------------
create table public.workspace_preferences (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id, key)
);

create trigger workspace_preferences_set_updated_at
before update on public.workspace_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Soft analysis usage per workspace (not billing)
-- ---------------------------------------------------------------------------
create table public.workspace_usage (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  analyses_this_month integer not null default 0,
  analyses_month_key text,
  last_analyzed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger workspace_usage_set_updated_at
before update on public.workspace_usage
for each row execute function public.set_updated_at();

-- Wire signup trigger after workspaces exist
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Safe workspace bootstrap for authenticated users (avoids RLS chicken-and-egg)
create or replace function public.create_workspace_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
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
