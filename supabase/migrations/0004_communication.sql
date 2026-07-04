-- 0004_communication.sql — Phase 5 (Communication)
-- Three features share this migration:
--   1. Unified contact timeline  -> contacts.ai_summary cache (+ timestamp).
--   2. Review requests           -> review_requests gains the never-silent
--      draft->send spine (body/channel/status machine), mirroring
--      followup_drafts; job_id now references the won deal it reviews.
--   3. Booking / FAQ widget       -> widget_config (owner profile + public
--      token) and an appointments 'requested' state for visitor bookings the
--      owner confirms later.
-- Portfolio project: fake/seed data only, never real business data.

-- ---------------------------------------------------------------------------
-- 1. contacts: relationship-summary cache for the unified timeline
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column ai_summary          text,
  add column summary_updated_at  timestamptz;

-- ---------------------------------------------------------------------------
-- 2. review_requests: the never-silent review draft->send spine.
--    Existing rows: none (table unused pre-Phase 5), so reshaping status and
--    switching the default is safe.
-- ---------------------------------------------------------------------------
alter table public.review_requests
  add column channel       text not null default 'email' check (channel in ('email', 'sms')),
  add column body          text,
  add column review_notes  jsonb;

alter table public.review_requests alter column status set default 'draft';
alter table public.review_requests drop constraint if exists review_requests_status_check;
alter table public.review_requests
  add constraint review_requests_status_check
  check (status in ('draft', 'approved', 'sending', 'sent', 'failed'));

-- job_id is the won deal (completed job) this review is for.
alter table public.review_requests
  add constraint review_requests_job_id_fkey
  foreign key (job_id) references public.deals (id) on delete set null;

create index review_requests_status_idx on public.review_requests (user_id, status);
create index review_requests_job_id_idx on public.review_requests (job_id);

-- ---------------------------------------------------------------------------
-- 3a. appointments: a visitor-requested state (owner confirms -> scheduled).
-- ---------------------------------------------------------------------------
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('requested', 'scheduled', 'completed', 'cancelled', 'no_show'));

alter table public.appointments
  add column notes   text,
  add column source  text;

-- ---------------------------------------------------------------------------
-- 3b. widget_config: one row per owner. The public booking/FAQ widget is keyed
--     by public_token; the widget-public edge function reads this with the
--     service role and hard-scopes every write to user_id. RLS below governs
--     only the owner's own dashboard CRUD.
-- ---------------------------------------------------------------------------
create table public.widget_config (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade unique,
  public_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  business_name text,
  services      text,
  hours         text,
  faq           text,
  review_link   text,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index widget_config_public_token_idx on public.widget_config (public_token);

create trigger widget_config_set_updated_at
  before update on public.widget_config
  for each row execute function public.set_updated_at();

alter table public.widget_config enable row level security;

create policy widget_config_owner_all on public.widget_config
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
