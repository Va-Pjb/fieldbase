import type { Tables, TablesInsert, TablesUpdate } from '@fieldbase/shared-types'
import { getSupabase } from '../lib/supabase.js'

export type Contact = Tables<'contacts'>
export type ContactInsert = TablesInsert<'contacts'>
export type ContactUpdate = TablesUpdate<'contacts'>

// PostgREST `.or()` treats commas/parens as syntax; strip them from user input.
function sanitize(term: string): string {
  return term.replace(/[,()*]/g, ' ').trim()
}

export async function listContacts(
  opts: { search?: string; limit?: number } = {},
): Promise<Contact[]> {
  let query = getSupabase().from('contacts').select('*').order('created_at', { ascending: false })
  const term = opts.search ? sanitize(opts.search) : ''
  if (term) {
    const like = `%${term}%`
    query = query.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`)
  }
  if (opts.limit) query = query.limit(opts.limit)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await getSupabase()
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createContact(input: ContactInsert): Promise<Contact> {
  const { data, error } = await getSupabase().from('contacts').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function updateContact(id: string, patch: ContactUpdate): Promise<Contact> {
  const { data, error } = await getSupabase()
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
