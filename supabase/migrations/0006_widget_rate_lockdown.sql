-- 0006_widget_rate_lockdown.sql — Phase 5 (Communication), T5 security-advisor fix
-- widget_rate_bump is SECURITY DEFINER and was still executable by anon /
-- authenticated via PostgREST RPC: Postgres grants EXECUTE to PUBLIC by default,
-- and 0005 only revoked from anon/authenticated (which inherit via PUBLIC).
-- Revoke from PUBLIC and grant EXECUTE to the service role only — the
-- service-role widget-public edge function is the sole intended caller.
revoke execute on function public.widget_rate_bump(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.widget_rate_bump(text, timestamptz, integer) to service_role;
