import { test, expect, type Locator, type Page } from '@playwright/test'

// Dedicated, pre-confirmed E2E user in the fieldbase project (fake data only).
const EMAIL = 'e2e-fieldbase@mailinator.com'
const PASSWORD = 'FieldBase-E2E-1234'
const CONTACT = 'E2E Plumbing Co'
const DEAL = 'E2E hot water callout'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(EMAIL)
  await page.getByLabel(/password/i).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
}

// Deterministic reset: wait for the counts to load before deciding to clear,
// so we never skip clearing due to a not-yet-loaded count.
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

// dnd-kit needs real pointer movement past its activation distance.
async function dragTo(page: Page, cardText: string, column: Locator) {
  const from = await page.getByText(cardText, { exact: true }).boundingBox()
  const to = await column.boundingBox()
  if (!from || !to) throw new Error('bounding box unavailable')
  const cx = from.x + from.width / 2
  const cy = from.y + from.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 15, cy + 8, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 140), { steps: 20 })
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 140), { steps: 5 })
  await page.mouse.up()
}

test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('core CRM flow: auth, contact CRUD, deal create + stage move persists', async ({ page }) => {
  await login(page)

  // Reset this user's data for a deterministic run.
  await resetData(page)

  // Create a contact.
  await page.getByRole('link', { name: 'Contacts' }).click()
  await page.getByRole('button', { name: '+ New contact' }).first().click()
  await expect(page).toHaveURL(/\/contacts\/new$/)
  await page.getByLabel(/name/i).fill(CONTACT)
  await page.getByLabel(/company/i).fill(CONTACT)
  await page.getByLabel(/email/i).fill('ops@e2eplumbing.example')
  await page.getByRole('button', { name: /create contact/i }).click()
  await expect(page.getByRole('heading', { name: CONTACT })).toBeVisible()

  // It shows in the list; search filters to it.
  await page.getByRole('link', { name: 'Contacts' }).click()
  await expect(page.getByRole('button', { name: CONTACT })).toBeVisible()
  await page.getByPlaceholder(/search/i).fill('E2E')
  await expect(page.getByRole('button', { name: CONTACT })).toBeVisible()

  // Create a deal in the pipeline.
  await page.getByRole('link', { name: 'Pipeline' }).click()
  await page.getByRole('button', { name: '+ New deal' }).first().click()
  await page.getByLabel(/title/i).fill(DEAL)
  await page.getByLabel('Contact', { exact: false }).selectOption({ label: CONTACT })
  await page.getByLabel(/value/i).fill('1000')
  await page.getByLabel(/stage/i).selectOption('lead')
  await page.getByRole('button', { name: /create deal/i }).click()

  const leadCol = page.locator('section', { has: page.getByRole('heading', { name: 'Lead' }) })
  await expect(leadCol.getByText(DEAL)).toBeVisible()

  // Drag Lead -> Qualified.
  const qualified = page.locator('section', { has: page.getByRole('heading', { name: 'Qualified' }) })
  await dragTo(page, DEAL, qualified)
  await expect(qualified.getByText(DEAL)).toBeVisible()

  // Persistence: reload and confirm it stuck.
  await page.reload()
  const qualifiedAfter = page.locator('section', {
    has: page.getByRole('heading', { name: 'Qualified' }),
  })
  await expect(qualifiedAfter.getByText(DEAL)).toBeVisible()

  // Nav routing + active state.
  await page.getByRole('link', { name: 'Contacts' }).click()
  await expect(page).toHaveURL(/\/contacts$/)
  await expect(page.getByRole('link', { name: 'Contacts' })).toHaveAttribute('aria-current', 'page')
})

test('sample data loader populates then clears', async ({ page }) => {
  await login(page)

  // Start clean.
  await resetData(page)

  // Load sample data -> confirmation message.
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await expect(page.getByText(/Loaded \d+ contacts/)).toBeVisible()

  // A known sample contact shows in the list.
  await page.getByRole('link', { name: 'Contacts' }).click()
  await expect(page.getByRole('button', { name: 'Rivergum Dental' })).toBeVisible()

  // Clear again to leave a clean slate.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Clear my data' }).click()
  await page.getByRole('button', { name: /^confirm/i }).click()
  await expect(page.getByRole('button', { name: 'Clear my data' })).toBeDisabled()
})
