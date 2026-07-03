-- 0001_init.sql — FieldBase initial schema (Phase 0, Task 2)
-- 7 core tables. Every table carries a user_id owner column and is RLS-scoped
-- so an authenticated user can CRUD only their own rows.
-- Portfolio project: fake/seed data only, never real business data.

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  company     text,
  source      text,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index contacts_user_id_idx on public.contacts (user_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------
create table public.deals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  title        text not null,
  stage        text not null default 'lead'
                 check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value        numeric(12, 2),
  probability  integer check (probability between 0 and 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index deals_user_id_idx on public.deals (user_id);
create index deals_contact_id_idx on public.deals (contact_id);
create index deals_stage_idx on public.deals (stage);

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- interactions
-- ---------------------------------------------------------------------------
create table public.interactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  type         text not null check (type in ('call', 'email', 'note', 'sms')),
  content      text,
  ai_summary   text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index interactions_user_id_idx on public.interactions (user_id);
create index interactions_contact_id_idx on public.interactions (contact_id);

-- ---------------------------------------------------------------------------
-- automations
-- ---------------------------------------------------------------------------
create table public.automations (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                     text not null,
  trigger_type             text not null,
  trigger_config           jsonb not null default '{}'::jsonb,
  action_type              text not null,
  action_config            jsonb not null default '{}'::jsonb,
  natural_language_source  text,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index automations_user_id_idx on public.automations (user_id);

create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- migration_jobs
-- ---------------------------------------------------------------------------
create table public.migration_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status           text not null default 'pending'
                     check (status in ('pending', 'previewed', 'executing', 'completed', 'failed')),
  source_filename  text,
  mapping_plan     jsonb,
  review_notes     jsonb,
  created_at       timestamptz not null default now(),
  executed_at      timestamptz
);
create index migration_jobs_user_id_idx on public.migration_jobs (user_id);

-- ---------------------------------------------------------------------------
-- review_requests
-- ---------------------------------------------------------------------------
create table public.review_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id  uuid not null references public.contacts (id) on delete cascade,
  job_id      uuid,  -- loose batch identifier for a send job (no send-jobs table in v1)
  status      text not null default 'pending'
                check (status in ('pending', 'sent', 'completed', 'failed')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index review_requests_user_id_idx on public.review_requests (user_id);
create index review_requests_contact_id_idx on public.review_requests (contact_id);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id  uuid not null references public.contacts (id) on delete cascade,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  status      text not null default 'scheduled'
                check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at  timestamptz not null default now()
);
create index appointments_user_id_idx on public.appointments (user_id);
create index appointments_contact_id_idx on public.appointments (contact_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security: every table scoped to its owning user.
-- One policy per table for all commands; auth.uid() wrapped in a subselect so
-- it is evaluated once per query (Supabase performance guidance). The
-- service_role key used by the MCP server bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table public.contacts        enable row level security;
alter table public.deals           enable row level security;
alter table public.interactions    enable row level security;
alter table public.automations     enable row level security;
alter table public.migration_jobs  enable row level security;
alter table public.review_requests enable row level security;
alter table public.appointments    enable row level security;

create policy contacts_owner_all on public.contacts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy deals_owner_all on public.deals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy interactions_owner_all on public.interactions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy automations_owner_all on public.automations
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy migration_jobs_owner_all on public.migration_jobs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy review_requests_owner_all on public.review_requests
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy appointments_owner_all on public.appointments
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
