-- Intelligence evaluation runs (internal only).
-- Access is enforced in application code via LUME_EVAL_ALLOWED_EMAILS.
-- Authenticated clients have NO direct table access; service role only.

create table public.eval_runs (
  id uuid primary key,
  created_at timestamptz not null default timezone('utc', now()),
  label text not null,
  status text not null
    check (status in ('running', 'complete', 'failed')),
  git_commit text,
  lume_version text,
  fixture_version text not null,
  fixture_label text not null default '',
  lume_model text,
  baseline_model text,
  baseline_prompt_version text not null default 'gpt-baseline-v1',
  created_by_email text not null,
  notes text,
  world_filter jsonb,
  category_filter jsonb,
  summary jsonb not null default '{}'::jsonb,
  cases jsonb not null default '[]'::jsonb
);

create index eval_runs_created_at_idx on public.eval_runs (created_at desc);
create index eval_runs_fixture_version_idx on public.eval_runs (fixture_version);

alter table public.eval_runs enable row level security;
alter table public.eval_runs force row level security;

-- No policies for authenticated/anon → deny by default under FORCE RLS.
-- service_role bypasses RLS.

revoke all on table public.eval_runs from anon, authenticated;
grant all on table public.eval_runs to service_role;
