import { supabase } from '../supabaseClient'
import type { Tables, TablesInsert, TablesUpdate } from '@fieldbase/shared-types'

export type Contact = Tables<'contacts'>
export type ContactInsert = TablesInsert<'contacts'>
export type ContactUpdate = TablesUpdate<'contacts'>

// PostgREST `.or()` uses commas/parens as syntax; strip them from user input.
function sanitize(term: string): string {
  return term.replace(/[,()*]/g, ' ').trim()
}

export async function listContacts(search?: string): Promise<Contact[]> {
  let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })
  const term = search ? sanitize(search) : ''
  if (term) {
    const like = `%${term}%`
    query = query.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createContact(input: ContactInsert): Promise<Contact> {
  // user_id defaults to auth.uid() in the DB; RLS enforces ownership.
  const { data, error } = await supabase.from('contacts').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function updateContact(id: string, patch: ContactUpdate): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}
