import { supabase } from '../supabaseClient'
import type { MigrationExecuteResult, MigrationPreviewResult } from '@fieldbase/shared-types'

// supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
// message is generic; the real reason is JSON in the underlying Response. Pull
// out the { error } field so the wizard can show what actually went wrong.
async function edgeError(error: unknown, fallback: string): Promise<Error> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string }
      if (body?.error) return new Error(body.error)
    } catch {
      /* fall through */
    }
  }
  return new Error(error instanceof Error ? error.message : fallback)
}

/** Stage an import: AI proposes a mapping plan and a migration job is created. */
export async function previewMigration(input: {
  csv: string
  instructions: string
  filename: string
}): Promise<MigrationPreviewResult> {
  const { data, error } = await supabase.functions.invoke('migration-preview', { body: input })
  if (error) throw await edgeError(error, 'Preview failed.')
  return data as MigrationPreviewResult
}

/** Execute a previewed job by id — the only path that writes contacts. */
export async function executeMigration(jobId: string): Promise<MigrationExecuteResult> {
  const { data, error } = await supabase.functions.invoke('migration-execute', {
    body: { jobId },
  })
  if (error) throw await edgeError(error, 'Import failed.')
  return data as MigrationExecuteResult
}
