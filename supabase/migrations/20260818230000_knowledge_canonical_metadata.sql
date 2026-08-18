-- Slice 1: additive canonical metadata on knowledge_items (nullable / safe defaults).
-- Does not recategorise existing rows. epistemic null = legacy (unknown certainty).

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

-- Soft checks via constraint only when values present (Postgres CHECK on column).
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
