-- Tell Me V1: project intelligence snapshots (compact, RLS-scoped).
-- Snapshot refresh is explicit; this table never mutates project records.

create table public.project_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  summary text not null default '',
  key_state jsonb not null default '[]'::jsonb,
  constraint_notes jsonb not null default '[]'::jsonb,
  major_risks jsonb not null default '[]'::jsonb,
  key_dependencies jsonb not null default '[]'::jsonb,
  key_stakeholders jsonb not null default '[]'::jsonb,
  important_knowledge jsonb not null default '[]'::jsonb,
  significant_dates jsonb not null default '[]'::jsonb,
  suggested_questions jsonb not null default '[]'::jsonb,
  source_revision text not null,
  kind text not null default 'deterministic'
    check (kind in ('deterministic', 'ai_refresh')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index project_intelligence_snapshots_project_id_idx
  on public.project_intelligence_snapshots (project_id);

create index project_intelligence_snapshots_workspace_id_idx
  on public.project_intelligence_snapshots (workspace_id);

-- One current snapshot row per project (latest wins via upsert in app).
create unique index project_intelligence_snapshots_project_unique
  on public.project_intelligence_snapshots (project_id);

create trigger project_intelligence_snapshots_set_updated_at
before update on public.project_intelligence_snapshots
for each row execute function public.set_updated_at();

alter table public.project_intelligence_snapshots enable row level security;
alter table public.project_intelligence_snapshots force row level security;

create policy project_intelligence_snapshots_select_member
  on public.project_intelligence_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy project_intelligence_snapshots_insert_member
  on public.project_intelligence_snapshots for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = project_intelligence_snapshots.workspace_id
    )
  );

create policy project_intelligence_snapshots_update_member
  on public.project_intelligence_snapshots for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = project_intelligence_snapshots.workspace_id
    )
  );

create policy project_intelligence_snapshots_delete_member
  on public.project_intelligence_snapshots for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.project_intelligence_snapshots to authenticated;
