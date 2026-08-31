-- Retrieval tags: metadata only. Deleting every tag must leave project truth unchanged.
-- Tags never participate in identity, resolution, Capture apply, or Change Intelligence.
-- Also adds workspace-scoped unique project codes (authoritative uniqueness).

create unique index if not exists projects_workspace_code_lower_idx
  on public.projects (workspace_id, lower(code));

create table public.project_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  slug text not null,
  origin text not null default 'custom'
    check (origin in ('predefined', 'custom')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, slug)
);

create index project_tags_workspace_id_idx on public.project_tags (workspace_id);
create index project_tags_project_id_idx on public.project_tags (project_id);

create table public.item_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  tag_id uuid not null references public.project_tags (id) on delete cascade,
  target_kind text not null
    check (target_kind in ('risk', 'todo', 'stakeholder', 'knowledge_item', 'milestone')),
  target_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tag_id, target_kind, target_id)
);

create index item_tags_workspace_id_idx on public.item_tags (workspace_id);
create index item_tags_project_id_idx on public.item_tags (project_id);
create index item_tags_target_idx on public.item_tags (project_id, target_kind, target_id);

alter table public.project_tags enable row level security;
alter table public.project_tags force row level security;
alter table public.item_tags enable row level security;
alter table public.item_tags force row level security;

create policy project_tags_select_member
  on public.project_tags for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy project_tags_insert_member
  on public.project_tags for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = project_tags.workspace_id
    )
  );

create policy project_tags_update_member
  on public.project_tags for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = project_tags.workspace_id
    )
  );

create policy project_tags_delete_member
  on public.project_tags for delete to authenticated
  using (public.is_workspace_member(workspace_id));

create policy item_tags_select_member
  on public.item_tags for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy item_tags_insert_member
  on public.item_tags for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = item_tags.workspace_id
    )
    and exists (
      select 1 from public.project_tags t
      where t.id = tag_id and t.workspace_id = item_tags.workspace_id
    )
  );

create policy item_tags_update_member
  on public.item_tags for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = item_tags.workspace_id
    )
  );

create policy item_tags_delete_member
  on public.item_tags for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.project_tags to authenticated, service_role;
grant select, insert, update, delete on public.item_tags to authenticated, service_role;
