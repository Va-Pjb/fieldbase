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

test('automation builder + missed-lead follow-up + never-silent guard', async ({ page }) => {
  await login(page)
  await resetData(page)

  await page.getByRole('link', { name: 'Automations' }).click()

  // --- Builder: plain English -> validated rule, listed. ---
  await page
    .getByLabel(/describe an automation/i)
    .fill("Follow up with new leads we haven't contacted in a day, by email")
  await page.getByRole('button', { name: /create automation/i }).click()
  await expect(page.getByText(/no contact for 24h/i).first()).toBeVisible()
  await expect(page.getByText(/draft an email follow-up/i).first()).toBeVisible()

  // --- Guard 1: no send control exists before any draft. ---
  await expect(page.getByRole('button', { name: /approve & send/i })).toHaveCount(0)

  // --- Guard 2: a direct followup-send with no draftId is rejected. ---
  const guardStatus = await page.evaluate(
    async ({ url, anon }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/functions/v1/followup-send`, {
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
    { url: SUPABASE_URL, anon: ANON_KEY },
  )
  expect(guardStatus).toBe(400)

  // --- Seed a cold lead (created 3 days ago, never contacted). ---
  const createdAt = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const contactId = await page.evaluate(
    async ({ url, anon, createdAt }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/rest/v1/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${token ?? ''}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: 'Cold E2E Lead',
          company: 'Cold Roofing Co',
          email: 'cold@example.com',
          created_at: createdAt,
        }),
      })
      const rows = await res.json()
      return Array.isArray(rows) && rows[0] ? (rows[0].id as string) : null
    },
    { url: SUPABASE_URL, anon: ANON_KEY, createdAt },
  )
  expect(contactId).toBeTruthy()

  // --- Scan -> draft appears for the cold lead. ---
  await page.getByRole('button', { name: /find leads to follow up/i }).click()
  await expect(page.getByText('Cold E2E Lead')).toBeVisible({ timeout: 20_000 })
  const approve = page.getByRole('button', { name: /approve & send/i }).first()
  await expect(approve).toBeVisible()

  // --- Approve & send -> sent state. ---
  await approve.click()
  await expect(page.getByText('Sent').first()).toBeVisible()

  // --- The send logged an interaction (no timeline UI yet, so verify via REST). ---
  const hasInteraction = await page.evaluate(
    async ({ url, anon, cid }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(
        `${url}/rest/v1/interactions?contact_id=eq.${cid}&select=ai_summary,type`,
        { headers: { apikey: anon, Authorization: `Bearer ${token ?? ''}` } },
      )
      const rows = (await res.json()) as { ai_summary?: string }[]
      return Array.isArray(rows) && rows.some((r) => r.ai_summary === 'AI follow-up sent')
    },
    { url: SUPABASE_URL, anon: ANON_KEY, cid: contactId },
  )
  expect(hasInteraction).toBe(true)
})
