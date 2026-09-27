import { test, expect } from '@playwright/test'

const requiredUrl = process.env.E2E_BASE_URL
const apiUrl = process.env.E2E_API_URL

test.describe('production smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!requiredUrl || !apiUrl, 'E2E_BASE_URL and E2E_API_URL are required for deployed smoke testing')
    page.on('console', (message) => {
      if (message.type() === 'error') testInfo.attachments.push({
        name: 'console-error',
        body: Buffer.from(message.text()),
        contentType: 'text/plain',
      })
    })
    page.on('requestfailed', (request) => testInfo.attachments.push({
      name: 'failed-request',
      body: Buffer.from(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`),
      contentType: 'text/plain',
    }))
  })

  test('HTTPS homepage and SPA assets load', async ({ page }) => {
    expect(new URL(requiredUrl!).protocol).toBe('https:')
    const response = await page.goto('/')
    expect(response?.ok()).toBeTruthy()
    await expect(page).toHaveTitle(/SmartCorp|Smart/i)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('login route and API health are reachable', async ({ page, request }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in|welcome/i })).toBeVisible()
    const health = await request.get(`${apiUrl!.replace(/\/$/, '')}/health/`)
    expect(health.ok()).toBeTruthy()
    expect((await health.json()).status).toBe('ok')
  })

  test('unknown SPA route renders not-found instead of server 404', async ({ page }) => {
    const response = await page.goto('/qa-nonexistent-route')
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toContainText(/not found|page/i)
  })
})
