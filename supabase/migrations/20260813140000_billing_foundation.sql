-- Phase 2.5 / 3A: workspace-scoped billing foundation (no card data).
-- Subscription/trial status is authoritative here; browser clients cannot write paid status.

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index billing_customers_stripe_customer_id_idx
  on public.billing_customers (stripe_customer_id);

create trigger billing_customers_set_updated_at
before update on public.billing_customers
for each row execute function public.set_updated_at();

-- Canonical Lume subscription statuses (mapped from Stripe later)
-- trialing | active | past_due | cancelled | expired
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  billing_customer_id uuid references public.billing_customers (id) on delete set null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Idempotent Stripe (or other provider) event processing
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  processed_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

create index billing_events_workspace_id_idx on public.billing_events (workspace_id);

-- Start a trial exactly once for a workspace (security definer; membership-checked).
create or replace function public.ensure_workspace_trial(p_workspace_id uuid, p_trial_days integer default 14)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  existing public.subscriptions;
  started timestamptz := timezone('utc', now());
  ends timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_trial_days is null or p_trial_days < 1 then
    p_trial_days := 14;
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Not a workspace member';
  end if;

  select * into existing
  from public.subscriptions s
  where s.workspace_id = p_workspace_id;

  if found then
    return existing;
  end if;

  ends := started + make_interval(days => p_trial_days);

  insert into public.billing_customers (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;

  insert into public.subscriptions (
    workspace_id,
    billing_customer_id,
    status,
    trial_started_at,
    trial_ends_at
  )
  values (
    p_workspace_id,
    (select id from public.billing_customers where workspace_id = p_workspace_id),
    'trialing',
    started,
    ends
  )
  returning * into existing;

  return existing;
end;
$$;

revoke all on function public.ensure_workspace_trial(uuid, integer) from public;
grant execute on function public.ensure_workspace_trial(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_customers enable row level security;
alter table public.billing_customers force row level security;
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

-- Members may READ billing state for their workspace (UX).
create policy billing_customers_select_member
  on public.billing_customers for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy subscriptions_select_member
  on public.subscriptions for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- No INSERT/UPDATE/DELETE policies for authenticated on billing tables.
-- Browser clients cannot self-grant paid status. Service role / security definer only.

-- billing_events: no authenticated access (webhook/service only)
-- (RLS enabled + no policies ⇒ denied for anon/authenticated)

grant select on table public.billing_customers to authenticated;
grant select on table public.subscriptions to authenticated;
-- no grant on billing_events to authenticated

grant select, insert, update, delete on table
  public.billing_customers,
  public.subscriptions,
  public.billing_events
to service_role;
