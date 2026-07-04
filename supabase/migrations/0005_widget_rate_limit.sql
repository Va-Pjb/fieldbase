-- 0005_widget_rate_limit.sql — Phase 5 (Communication), T5 hardening
-- Lightweight fixed-window rate limiting for the PUBLIC widget-public endpoint
-- (H1 from the T5 security review). Only the service-role widget-public function
-- touches this: RLS is enabled with NO policy so no anon/authenticated client
-- can read or write it, and EXECUTE on the bump function is limited to the
-- service role.

create table public.widget_rate (
  bucket        text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, window_start)
);
alter table public.widget_rate enable row level security;
-- Intentionally no policies: locked to the service role / definer function.

-- Atomic fixed-window increment. Returns true when the request is allowed
-- (post-increment count <= p_limit), false when the limit is exceeded.
create or replace function public.widget_rate_bump(
  p_bucket text,
  p_window_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.widget_rate (bucket, window_start, count)
    values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
    do update set count = public.widget_rate.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.widget_rate_bump(text, timestamptz, integer) from anon, authenticated;
