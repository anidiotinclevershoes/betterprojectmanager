-- Approved Capture Apply operation receipts.
-- Same Review/Apply operation identity replays to one authoritative row.
-- Not title uniqueness. Not History-as-truth.

create table public.capture_apply_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  operation_id text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, project_id, operation_id)
);

create index capture_apply_receipts_workspace_id_idx
  on public.capture_apply_receipts (workspace_id);

create index capture_apply_receipts_project_id_idx
  on public.capture_apply_receipts (project_id);

alter table public.capture_apply_receipts enable row level security;
alter table public.capture_apply_receipts force row level security;

create policy capture_apply_receipts_select_member
  on public.capture_apply_receipts for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy capture_apply_receipts_insert_member
  on public.capture_apply_receipts for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = capture_apply_receipts.workspace_id
    )
  );

create policy capture_apply_receipts_delete_member
  on public.capture_apply_receipts for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select, insert, delete on public.capture_apply_receipts to authenticated;
