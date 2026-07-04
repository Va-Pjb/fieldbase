import { test, expect, type Page } from '@playwright/test'

const EMAIL = 'e2e-fieldbase@mailinator.com'
const PASSWORD = 'FieldBase-E2E-1234'

// Public project config (safe in the browser; RLS enforces access).
const SUPABASE_URL = 'https://jfadebznlevlluutkbll.supabase.co'
const ANON_KEY = 'sb_publishable_VZ-4E3FfLqiqW75431upYA_OTlQxLnY'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(EMAIL)
  await page.getByLabel(/password/i).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
}

async function resetData(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.locator('dl dd').first()).toHaveText(/^\d+$/)
  const clearBtn = page.getByRole('button', { name: 'Clear my data' })
  if (await clearBtn.isEnabled()) {
    await clearBtn.click()
    await page.getByRole('button', { name: /^confirm/i }).click()
    await expect(clearBtn).toBeDisabled()
  }
}

// --- REST helpers: run in-page so the logged-in session JWT is attached. ---
async function insertRow(page: Page, path: string, row: unknown): Promise<string | null> {
  return page.evaluate(
    async ({ url, anon, path, row }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/rest/v1/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${token ?? ''}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(row),
      })
      const rows = (await res.json()) as { id?: string }[]
      return Array.isArray(rows) && rows[0]?.id ? rows[0].id : null
    },
    { url: SUPABASE_URL, anon: ANON_KEY, path, row },
  )
}

async function countRows(page: Page, query: string): Promise<number> {
  return page.evaluate(
    async ({ url, anon, query }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/rest/v1/${query}`, {
        headers: { apikey: anon, Authorization: `Bearer ${token ?? ''}` },
      })
      const rows = (await res.json()) as unknown[]
      return Array.isArray(rows) ? rows.length : 0
    },
    { url: SUPABASE_URL, anon: ANON_KEY, query },
  )
}

async function sendGuardStatus(page: Page, fn: string): Promise<number> {
  return page.evaluate(
    async ({ url, anon, fn }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({}),
      })
      return res.status
    },
    { url: SUPABASE_URL, anon: ANON_KEY, fn },
  )
}

test('contact timeline + AI relationship summary', async ({ page }) => {
  await login(page)
  await resetData(page)

  const contactId = await insertRow(page, 'contacts', {
    name: 'Timeline E2E Client',
    company: 'Harbourview Homes',
    email: 'timeline@example.com',
  })
  expect(contactId).toBeTruthy()

  await insertRow(page, 'interactions', {
    contact_id: contactId,
    type: 'call',
    content: 'Discussed the leaking hot water system',
    ai_summary: 'Scoping call',
    occurred_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  })
  await insertRow(page, 'appointments', {
    contact_id: contactId,
    start_time: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    end_time: new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString(),
    status: 'scheduled',
    notes: 'On-site quote visit',
  })

  await page.goto(`/contacts/${contactId}`)

  // Merged timeline shows the interaction + the appointment.
  await expect(page.getByText('Discussed the leaking hot water system')).toBeVisible()
  await expect(page.getByText('On-site quote visit')).toBeVisible()

  // Generate the AI relationship summary; button flips to Regenerate when cached.
  await page.getByRole('button', { name: /^generate$/i }).click()
  await expect(page.getByRole('button', { name: /regenerate/i })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/updated/i)).toBeVisible()
})

test('review requests: never-silent guard + draft, approve & send', async ({ page }) => {
  await login(page)
  await resetData(page)

  // Seed a completed job: a contact with a won deal.
  const contactId = await insertRow(page, 'contacts', {
    name: 'Review E2E Client',
    company: 'Delta Builders',
    email: 'review@example.com',
  })
  expect(contactId).toBeTruthy()
  await insertRow(page, 'deals', { contact_id: contactId, title: 'Ensuite renovation', stage: 'won', value: 6500 })

  await page.getByRole('link', { name: 'Communication' }).click()
  await expect(page.getByRole('heading', { name: /review requests/i })).toBeVisible()

  // Guard 1: no send control before any draft exists.
  await expect(page.getByRole('button', { name: /approve & send/i })).toHaveCount(0)

  // Guard 2: a direct review-request-send with no reviewId is rejected (400).
  expect(await sendGuardStatus(page, 'review-request-send')).toBe(400)

  // Scan -> a review draft appears for the won job.
  await page.getByRole('button', { name: /find jobs to request reviews/i }).click()
  await expect(page.getByText('Review E2E Client')).toBeVisible({ timeout: 30_000 })
  const approve = page.getByRole('button', { name: /approve & send/i }).first()
  await expect(approve).toBeVisible()

  // Approve & send -> sent state.
  await approve.click()
  await expect(page.getByText('Sent').first()).toBeVisible({ timeout: 15_000 })

  // The send landed on the contact timeline as a logged interaction.
  await page.goto(`/contacts/${contactId}`)
  await expect(page.getByText('Review request sent')).toBeVisible()
})

test('public booking/FAQ widget: ask + booking request', async ({ page }) => {
  await login(page)
  await resetData(page)

  // Configure the widget from Settings, then grab its public link.
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: /booking & faq widget/i })).toBeVisible()
  await page.getByPlaceholder('Northwind Plumbing Co').fill('Northwind Plumbing')
  await page
    .getByPlaceholder(/Q: Are quotes free/i)
    .fill('Q: What area do you cover? A: We cover the whole metro area within 30km of the depot.')
  await page.getByRole('button', { name: /save widget/i }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  const href = await page.getByRole('link', { name: /open/i }).getAttribute('href')
  expect(href).toContain('/widget/')
  const token = href!.split('/widget/')[1]

  // Visit the public widget (no app shell).
  await page.goto(`/widget/${token}`)
  await expect(page.getByText(/book with us/i)).toBeVisible()

  // Ask an FAQ grounded in the configured profile.
  await page.getByLabel(/your question/i).fill('What area do you cover?')
  await page.getByRole('button', { name: /send question/i }).click()
  await expect(page.getByText(/30\s?km|metro/i)).toBeVisible({ timeout: 30_000 })

  // Request a booking -> confirmation.
  await page.getByRole('button', { name: /request a booking/i }).click()
  const d = new Date(Date.now() + 3 * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  await page.getByLabel('Your name').fill('Widget E2E Booker')
  await page.getByLabel('Email').fill('widgetbooker@example.com')
  await page.getByLabel(/preferred time/i).fill(local)
  await page.getByLabel(/what do you need help with/i).fill('Leaking tap in the kitchen')
  await page.getByRole('button', { name: /request booking/i }).click()
  await expect(page.getByText(/request received/i)).toBeVisible({ timeout: 15_000 })

  // A pending (requested) appointment now exists for the owner.
  const requested = await countRows(page, 'appointments?source=eq.widget&status=eq.requested&select=id')
  expect(requested).toBeGreaterThan(0)
})
