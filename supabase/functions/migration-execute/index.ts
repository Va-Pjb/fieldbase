import { createClient } from 'npm:@supabase/supabase-js@2'
import { applyPlan, type MigrationPlan } from '../_shared/migration.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The single guarded write path. Accepts ONLY a job id produced by a prior
// migration-preview. There is no file -> import path here: without a valid
// previewed job, nothing is ever written.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Not authenticated.' }, 401)

    const body = (await req.json().catch(() => ({}))) as { jobId?: string; job_id?: string }
    const jobId = body.jobId ?? body.job_id
    if (!jobId || typeof jobId !== 'string' || !UUID_RE.test(jobId)) {
      return json({ error: 'A valid jobId from a prior migration-preview is required.' }, 400)
    }

    // Load the job. RLS restricts this to the caller's own jobs, so a job that
    // belongs to someone else simply reads as "not found".
    const { data: job, error: loadErr } = await supabase
      .from('migration_jobs')
      .select('id, status, mapping_plan, source_rows')
      .eq('id', jobId)
      .maybeSingle()
    if (loadErr) return json({ error: `Failed to load job: ${loadErr.message}` }, 500)
    if (!job) return json({ error: 'Job not found (or not yours).' }, 404)
    if (job.status !== 'previewed') {
      return json(
        { error: `Job is '${job.status}'; only a previewed job can be executed.` },
        409,
      )
    }
    if (!job.mapping_plan || !Array.isArray(job.source_rows)) {
      return json({ error: 'Job is missing its plan or stored rows; re-run preview.' }, 422)
    }

    // Atomically claim the job (previewed -> executing). If another request beat
    // us to it, zero rows update and we reject — no double import.
    const { data: claimed, error: claimErr } = await supabase
      .from('migration_jobs')
      .update({ status: 'executing' })
      .eq('id', jobId)
      .eq('status', 'previewed')
      .select('id')
      .maybeSingle()
    if (claimErr) return json({ error: `Failed to claim job: ${claimErr.message}` }, 500)
    if (!claimed) {
      return json({ error: 'Job is no longer previewed (already executing or executed).' }, 409)
    }

    const { contacts, warnings, skipped } = applyPlan(
      job.mapping_plan as MigrationPlan,
      job.source_rows as Record<string, string>[],
    )

    let imported = 0
    if (contacts.length > 0) {
      // RLS + the contacts.user_id default (auth.uid()) stamp the owner.
      const { data: ins, error: insErr } = await supabase
        .from('contacts')
        .insert(contacts)
        .select('id')
      if (insErr) {
        await supabase
          .from('migration_jobs')
          .update({ status: 'failed', review_notes: { error: insErr.message, skipped, warnings } })
          .eq('id', jobId)
        return json({ error: `Import failed: ${insErr.message}` }, 500)
      }
      imported = ins?.length ?? 0
    }

    await supabase
      .from('migration_jobs')
      .update({
        status: 'completed',
        executed_at: new Date().toISOString(),
        review_notes: { imported, skipped, warnings },
      })
      .eq('id', jobId)

    return json({ jobId, imported, skipped, warnings }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
