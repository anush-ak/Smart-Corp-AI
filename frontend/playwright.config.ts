import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SmartCorp AI live health tests.
 * Targets https://smart-corp-ai.vercel.app with 60-second timeouts per test
 * to accommodate Render free-tier backend cold starts.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 20 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'https://smart-corp-ai.vercel.app',
    headless: true,
    actionTimeout: 25 * 1000,
    navigationTimeout: 45 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
