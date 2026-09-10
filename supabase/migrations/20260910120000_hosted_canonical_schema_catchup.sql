-- D-050: hosted production lagged the full migration reconstruction.
-- Additive. Idempotent. Does not edit already-applied V1 RPC SQL.
--
-- Do not invent a junk knowledge_items.kind column. This replays the
-- canonical metadata the domain already uses
-- (`20260818230000_knowledge_canonical_metadata.sql`).
--
-- Retrieval tag tables are included because create_project_bundle inserts
-- into project_tags / item_tags even for an empty tag array. Missing tables
-- are the next hosted failure after `kind`. Schema matches
-- `20260831160000_project_retrieval_tags.sql` (name/slug/origin, not code/label).
--
-- Unique project-code index is applied only when there are no duplicates.
-- Duplicate codes are D-026: they must not roll back the columns/tables the
-- New Project RPC needs.

alter table public.knowledge_items
  add column if not exists kind text;

alter table public.knowledge_items
  add column if not exists epistemic text;

alter table public.knowledge_items
  add column if not exists lifecycle text not null default 'current';

alter table public.knowledge_items
  add column if not exists supersedes_id uuid references public.knowledge_items (id) on delete set null;

alter table public.knowledge_items
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.knowledge_items
  add column if not exists provenance jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_items_epistemic_check'
  ) then
    alter table public.knowledge_items
      add constraint knowledge_items_epistemic_check
      check (
        epistemic is null
        or epistemic in (
          'confirmed',
          'pending',
          'informal',
          'suggested',
          'inferred',
          'conflicting',
          'unknown',
          'legacy'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_items_lifecycle_check'
  ) then
    alter table public.knowledge_items
      add constraint knowledge_items_lifecycle_check
      check (lifecycle in ('current', 'superseded', 'historical'));
  end if;
end $$;

create index if not exists knowledge_items_project_lifecycle_idx
  on public.knowledge_items (project_id, lifecycle);

create table if not exists public.project_tags (
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

create index if not exists project_tags_workspace_id_idx on public.project_tags (workspace_id);
create index if not exists project_tags_project_id_idx on public.project_tags (project_id);

create table if not exists public.item_tags (
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

create index if not exists item_tags_workspace_id_idx on public.item_tags (workspace_id);
create index if not exists item_tags_project_id_idx on public.item_tags (project_id);
create index if not exists item_tags_target_idx on public.item_tags (project_id, target_kind, target_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_tags_id_project_id_key'
      and conrelid = 'public.project_tags'::regclass
  ) then
    alter table public.project_tags
      add constraint project_tags_id_project_id_key unique (id, project_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'item_tags_tag_matches_project_fk'
      and conrelid = 'public.item_tags'::regclass
  ) then
    alter table public.item_tags
      add constraint item_tags_tag_matches_project_fk
      foreign key (tag_id, project_id)
      references public.project_tags (id, project_id)
      on delete cascade;
  end if;
end $$;

alter table public.project_tags enable row level security;
alter table public.project_tags force row level security;
alter table public.item_tags enable row level security;
alter table public.item_tags force row level security;

drop policy if exists project_tags_select_member on public.project_tags;
create policy project_tags_select_member
  on public.project_tags for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists project_tags_insert_member on public.project_tags;
create policy project_tags_insert_member
  on public.project_tags for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.workspace_id = project_tags.workspace_id
    )
  );

drop policy if exists project_tags_update_member on public.project_tags;
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

drop policy if exists project_tags_delete_member on public.project_tags;
create policy project_tags_delete_member
  on public.project_tags for delete to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists item_tags_select_member on public.item_tags;
create policy item_tags_select_member
  on public.item_tags for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists item_tags_insert_member on public.item_tags;
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
      where t.id = tag_id
        and t.workspace_id = item_tags.workspace_id
        and t.project_id = item_tags.project_id
    )
  );

drop policy if exists item_tags_update_member on public.item_tags;
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

drop policy if exists item_tags_delete_member on public.item_tags;
create policy item_tags_delete_member
  on public.item_tags for delete to authenticated
  using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.project_tags to authenticated, service_role;
grant select, insert, update, delete on public.item_tags to authenticated, service_role;

do $$
declare
  dup text;
begin
  select string_agg(
    format('%s / %s ×%s', workspace_id::text, lower(code), cnt),
    ', '
  )
  into dup
  from (
    select workspace_id, lower(code) as code, count(*) as cnt
    from public.projects
    group by 1, 2
    having count(*) > 1
  ) d;

  if dup is not null then
    raise warning
      'Skipped projects_workspace_code_lower_idx; duplicate project codes already exist: %. Tag tables were still created. Reconcile codes, then apply 20260831160000 uniqueness.',
      dup;
    return;
  end if;

  create unique index if not exists projects_workspace_code_lower_idx
    on public.projects (workspace_id, lower(code));
end
$$;
