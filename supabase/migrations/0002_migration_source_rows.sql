-- 0002_migration_source_rows.sql — Phase 3 (AI Migration Wizard)
-- Store the parsed CSV rows on the job at preview time so migration_execute
-- needs only the job id (no re-upload of the file).
alter table public.migration_jobs
  add column source_rows jsonb;
