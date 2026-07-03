import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@fieldbase/shared-types'
import { config } from '../config.js'

let client: SupabaseClient<Database> | null = null

/** The authenticated, RLS-scoped client. Throws if the server hasn't inited. */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) throw new Error('Supabase not initialized — call initSupabase() first.')
  return client
}

/**
 * Sign in as the dedicated demo user so every query runs under that user's RLS
 * scope (writes get user_id = auth.uid() by default). No service-role key is
 * used, so the server is safe to expose. Also runs a startup DB check.
 */
export async function initSupabase(): Promise<{ userId: string; email: string }> {
  const c = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  })

  const { data, error } = await c.auth.signInWithPassword({
    email: config.demoUserEmail,
    password: config.demoUserPassword,
  })
  if (error || !data.user) {
    throw new Error(`Demo-user sign-in failed: ${error?.message ?? 'no user returned'}`)
  }

  const { error: dbError } = await c.from('contacts').select('*', { count: 'exact', head: true })
  if (dbError) throw new Error(`Startup DB check failed: ${dbError.message}`)

  client = c
  return { userId: data.user.id, email: data.user.email ?? config.demoUserEmail }
}
