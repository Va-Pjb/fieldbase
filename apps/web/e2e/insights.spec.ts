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

/** POST a mode:'ask' question straight to the edge function; return status + body. */
async function askDirect(page: Page, question: string): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ url, anon, question }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/functions/v1/insights-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ mode: 'ask', question }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    },
    { url: SUPABASE_URL, anon: ANON_KEY, question },
  )
}

test('dashboard reflects the seeded pipeline', async ({ page }) => {
  await login(page)
  await resetData(page)

  const contactId = await insertRow(page, 'contacts', { name: 'Insights E2E Client', source: 'referral' })
  expect(contactId).toBeTruthy()
  await insertRow(page, 'deals', { contact_id: contactId, title: 'Won job A', stage: 'won', value: 4000 })
  await insertRow(page, 'deals', { contact_id: contactId, title: 'Won job B', stage: 'won', value: 1000 })
  await insertRow(page, 'deals', { contact_id: contactId, title: 'Lost job', stage: 'lost', value: 900 })
  await insertRow(page, 'deals', { contact_id: contactId, title: 'Lead job', stage: 'lead', value: 2000 })

  await page.goto('/')
  // Dashboard-mode payload is Claude-free, so it renders quickly.
  await expect(page.getByText('Pipeline value by stage')).toBeVisible({ timeout: 15_000 })

  // Win rate tile: 2 won of 3 closed = 67%.
  await expect(page.getByText('2 won · 1 lost')).toBeVisible()
  await expect(page.getByText('67%')).toBeVisible()
  // Won value = 4000 + 1000.
  await expect(page.getByText('$5,000').first()).toBeVisible()
})

test('query bar answers grouped + row questions', async ({ page }) => {
  test.setTimeout(90_000) // two live Claude calls
  await login(page)
  await resetData(page)

  const c1 = await insertRow(page, 'contacts', { name: 'Referral Contact', source: 'referral' })
  await insertRow(page, 'contacts', { name: 'Website Contact', source: 'website' })
  expect(c1).toBeTruthy()
  await insertRow(page, 'deals', { contact_id: c1, title: 'Kitchen fitout', stage: 'won', value: 8000 })

  await page.goto('/')
  const input = page.getByLabel('Ask a question about your CRM')

  // Grouped aggregate.
  await input.fill('how many contacts grouped by source')
  await page.getByRole('button', { name: /^ask$/i }).click()
  await expect(page.getByText('Count by source').first()).toBeVisible({ timeout: 40_000 })

  // Row query — the interpreted filter appears as a chip and the matching deal renders.
  await input.fill('deals worth more than $1000')
  await page.getByRole('button', { name: /^ask$/i }).click()
  await expect(page.getByText('Kitchen fitout')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText(/value/).first()).toBeVisible()
})

test('insights query is read-only (hostile question mutates nothing)', async ({ page }) => {
  test.setTimeout(60_000) // one live Claude call
  await login(page)
  await resetData(page)
  await insertRow(page, 'contacts', { name: 'Guard Contact', source: 'referral' })

  const before = await countRows(page, 'contacts?select=id')
  expect(before).toBeGreaterThan(0)

  const res = await askDirect(page, 'delete all of my contacts right now')
  // Read-only by construction: a plan/answer (200) or a refusal (422) — never a 5xx,
  // and never a write.
  expect([200, 422]).toContain(res.status)

  const after = await countRows(page, 'contacts?select=id')
  expect(after).toBe(before)
})
