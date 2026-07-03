import { supabase } from './supabaseClient'
import type { ContactInsert } from './api/contacts'
import type { DealInsert, DealStage } from './api/deals'

// Fake service-SMB contacts. Sample data only — never real customers.
const SAMPLE_CONTACTS: ContactInsert[] = [
  { name: 'Rivergum Dental', company: 'Rivergum Dental', phone: '+61 7 5555 0101', email: 'reception@rivergumdental.example', source: 'referral', tags: ['clinic', 'commercial'] },
  { name: 'Coast Electrical', company: 'Coast Electrical', phone: '+61 4 1234 5678', email: 'jobs@coastelectrical.example', source: 'google', tags: ['trade', 'commercial'] },
  { name: 'Marcus Webb', phone: '+61 4 0000 1111', email: 'marcus.webb@example.com', source: 'website', tags: ['residential', 'lead'] },
  { name: 'Sunhaven Plumbing', company: 'Sunhaven Plumbing', phone: '+61 3 9000 2020', email: 'office@sunhavenplumbing.example', source: 'repeat', tags: ['trade'] },
  { name: 'Bayside Physio', company: 'Bayside Physiotherapy', phone: '+61 3 9444 7788', email: 'admin@baysidephysio.example', source: 'referral', tags: ['clinic'] },
  { name: 'Tom Nguyen', phone: '+61 4 2233 4455', email: 'tom.nguyen@example.com', source: 'facebook', tags: ['residential'] },
  { name: 'Apex Roofing', company: 'Apex Roofing', phone: '+61 2 8100 3030', email: 'quotes@apexroofing.example', source: 'google', tags: ['trade', 'commercial'] },
  { name: 'Verdant Landscapes', company: 'Verdant Landscapes', phone: '+61 4 7788 1122', email: 'hello@verdantland.example', source: 'website', tags: ['trade'] },
  { name: 'Priya Sharma', phone: '+61 4 5566 7788', email: 'priya.sharma@example.com', source: 'referral', tags: ['residential', 'vip'] },
  { name: 'Northshore Vet Clinic', company: 'Northshore Vet Clinic', phone: '+61 2 9900 4040', email: 'care@northshorevet.example', source: 'google', tags: ['clinic', 'commercial'] },
  { name: 'BrightSpark Electrical', company: 'BrightSpark Electrical', phone: '+61 8 6200 5050', email: 'bookings@brightspark.example', source: 'repeat', tags: ['trade'] },
  { name: 'Harbour City Locksmiths', company: 'Harbour City Locksmiths', phone: '+61 2 8200 6060', email: 'ops@harbourlocks.example', source: 'walk-in', tags: ['trade'] },
  { name: 'Olivia Grant', phone: '+61 4 3344 5566', email: 'olivia.grant@example.com', source: 'website', tags: ['residential'] },
  { name: 'Peak HVAC Services', company: 'Peak HVAC Services', phone: '+61 7 3300 7070', email: 'service@peakhvac.example', source: 'referral', tags: ['trade', 'commercial'] },
  { name: 'Daniel O’Brien', phone: '+61 4 6677 8899', email: 'daniel.obrien@example.com', source: 'facebook', tags: ['residential', 'lead'] },
  { name: 'Coastline Pool Care', company: 'Coastline Pool Care', phone: '+61 4 9911 2233', email: 'team@coastlinepool.example', source: 'google', tags: ['home-service'] },
  { name: 'Meadow Glass & Glazing', company: 'Meadow Glass & Glazing', phone: '+61 3 9700 8080', email: 'sales@meadowglass.example', source: 'repeat', tags: ['trade', 'commercial'] },
  { name: 'Hannah Lee', phone: '+61 4 1212 3434', email: 'hannah.lee@example.com', source: 'website', tags: ['residential', 'lead'] },
]

// Deals reference contacts by index into SAMPLE_CONTACTS above.
const SAMPLE_DEALS: {
  title: string
  stage: DealStage
  value: number
  probability: number
  contactIndex: number
}[] = [
  { title: 'Blocked drain callout', stage: 'lead', value: 380, probability: 10, contactIndex: 2 },
  { title: 'Hot water system replacement', stage: 'qualified', value: 2200, probability: 40, contactIndex: 5 },
  { title: 'Switchboard upgrade', stage: 'proposal', value: 4800, probability: 60, contactIndex: 1 },
  { title: 'Surgery fit-out — chair power + data', stage: 'negotiation', value: 18500, probability: 75, contactIndex: 0 },
  { title: 'Annual A/C service contract', stage: 'won', value: 3600, probability: 100, contactIndex: 13 },
  { title: 'Bathroom reno rough-in', stage: 'lost', value: 9200, probability: 0, contactIndex: 8 },
  { title: 'Roof leak repair', stage: 'qualified', value: 1500, probability: 50, contactIndex: 6 },
  { title: 'Garden irrigation install', stage: 'proposal', value: 6400, probability: 55, contactIndex: 7 },
  { title: 'Emergency lockout — rekey', stage: 'won', value: 240, probability: 100, contactIndex: 11 },
  { title: 'Pool pump replacement', stage: 'lead', value: 1850, probability: 20, contactIndex: 15 },
  { title: 'Shopfront glass replacement', stage: 'negotiation', value: 3200, probability: 70, contactIndex: 16 },
  { title: 'Clinic lighting upgrade', stage: 'qualified', value: 5200, probability: 45, contactIndex: 9 },
  { title: 'EV charger install', stage: 'proposal', value: 2100, probability: 60, contactIndex: 10 },
  { title: 'Ducted heating quote', stage: 'lead', value: 7800, probability: 15, contactIndex: 14 },
]

/** Insert the sample contacts + linked deals for the signed-in user. */
export async function loadSampleData(): Promise<{ contacts: number; deals: number }> {
  const { data: contacts, error } = await supabase
    .from('contacts')
    .insert(SAMPLE_CONTACTS)
    .select('id')
  if (error) throw error

  const deals: DealInsert[] = SAMPLE_DEALS.map((d) => ({
    title: d.title,
    stage: d.stage,
    value: d.value,
    probability: d.probability,
    contact_id: contacts[d.contactIndex].id,
  }))
  const { error: dealsError } = await supabase.from('deals').insert(deals)
  if (dealsError) throw dealsError

  return { contacts: contacts.length, deals: deals.length }
}

/** Delete the signed-in user's contacts (cascades to their deals etc.). */
export async function clearMyData(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You must be signed in.')
  const { error } = await supabase.from('contacts').delete().eq('user_id', auth.user.id)
  if (error) throw error
}
