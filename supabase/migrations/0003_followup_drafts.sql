-- 0003_followup_drafts.sql — Phase 4 (AI Automation Layer)
-- The never-silent spine for follow-ups: followup-draft creates a row here
-- (status='draft'); followup-send takes only its id, and no message is ever
-- sent without one. Mirrors migration_jobs' preview->execute guarantee.
create table public.followup_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id     uuid not null references public.contacts (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  channel        text not null check (channel in ('email', 'sms')),
  body           text not null,
  status         text not null default 'draft'
                   check (status in ('draft', 'approved', 'sending', 'sent', 'failed')),
  review_notes   jsonb,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create index followup_drafts_user_id_idx on public.followup_drafts (user_id);
create index followup_drafts_contact_id_idx on public.followup_drafts (contact_id);

alter table public.followup_drafts enable row level security;

create policy followup_drafts_owner_all on public.followup_drafts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
