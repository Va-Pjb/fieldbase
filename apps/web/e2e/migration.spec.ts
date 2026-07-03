import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Dedicated, pre-confirmed E2E user in the fieldbase project (fake data only).
const EMAIL = 'e2e-fieldbase@mailinator.com'
const PASSWORD = 'FieldBase-E2E-1234'

// Public project config (safe in the browser bundle; RLS enforces access).
const SUPABASE_URL = 'https://jfadebznlevlluutkbll.supabase.co'
const ANON_KEY = 'sb_publishable_VZ-4E3FfLqiqW75431upYA_OTlQxLnY'

const CSV_PATH = fileURLToPath(new URL('./fixtures/contacts-sample.csv', import.meta.url))
const NAMES = ['Wendy Fixture', 'Gary Fixture', 'Nadia Fixture']

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

async function uploadAndPreview(page: Page) {
  await page.getByRole('link', { name: 'Migration' }).click()
  await page.locator('input[type="file"]').setInputFiles(CSV_PATH)
  await expect(page.getByText(/3 rows detected/i)).toBeVisible()
  await page
    .getByPlaceholder(/map mobile to phone/i)
    .fill('Import these as contacts; map the obvious columns.')
  await page.getByRole('button', { name: /preview import/i }).click()
}

test('migration wizard: guard, cancel writes nothing, approve imports', async ({ page }) => {
  await login(page)
  await resetData(page)

  // --- Guard 1: the upload step offers no execute path (no preview yet). ---
  await page.getByRole('link', { name: 'Migration' }).click()
  await expect(page.getByRole('button', { name: /preview import/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /approve & import/i })).toHaveCount(0)

  // --- Guard 2: a direct migration-execute call with no jobId is rejected. ---
  const guardStatus = await page.evaluate(
    async ({ url, anon }) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
      const raw = key ? localStorage.getItem(key) : null
      const token = raw ? (JSON.parse(raw).access_token as string) : null
      const res = await fetch(`${url}/functions/v1/migration-execute`, {
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

  // --- Cancel writes nothing. ---
  await uploadAndPreview(page)
  await expect(page.getByRole('heading', { name: /column mapping/i })).toBeVisible()
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByRole('button', { name: /preview import/i })).toBeVisible()
  await page.getByRole('link', { name: 'Contacts' }).click()
  await expect(page.getByRole('button', { name: 'Wendy Fixture' })).toHaveCount(0)

  // --- Approve imports the contacts. ---
  await uploadAndPreview(page)
  await expect(page.getByRole('heading', { name: /column mapping/i })).toBeVisible()
  const approve = page.getByRole('button', { name: /approve & import 3 contacts/i })
  await expect(approve).toBeVisible()
  await approve.click()

  await expect(page.getByText(/import complete/i)).toBeVisible()
  await expect(page.getByText(/3 imported/i)).toBeVisible()

  await page.getByRole('link', { name: /view contacts/i }).click()
  for (const name of NAMES) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }
})
