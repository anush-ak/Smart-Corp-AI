import { test, expect, Page } from '@playwright/test';

// Target URL
const BASE_URL = 'https://smart-corp-ai.vercel.app';

// Test accounts
const ACCOUNTS = {
  anush: { name: 'Anush', email: 'anush@acmecorp.com', password: 'password123', role: 'Admin' },
  sidharth: { name: 'Sidharth', email: 'sidharth@acmecorp.com', password: 'password123', role: 'HR' },
  nicholas: { name: 'Nicholas', email: 'nicholas@acmecorp.com', password: 'password123', role: 'Manager' },
  hitesh: { name: 'Hitesh', email: 'hitesh@acmecorp.com', password: 'password123', role: 'Employee' },
};

/**
 * Helper to log in a user with explicit credentials.
 */
async function login(page: Page, email: string, password: string = 'password123') {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');

  // Clear previous session if any and ensure clean state
  await page.evaluate(() => {
    localStorage.removeItem('smartcorp_token');
    localStorage.removeItem('smartcorp_user');
  });

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = page.getByRole('button', { name: /sign in/i });
  await submitButton.click();

  // Wait for redirect to dashboard
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
    timeout: 30000,
  });
}

test.describe('SmartCorp AI Live Health Suite', () => {
  test.setTimeout(60000); // 60-second timeout per test to allow Render cold starts

  test.beforeAll(async ({ request }) => {
    // Warm up Render backend before starting module tests
    try {
      await request.get('https://smartcorp-ai-backend.onrender.com/api/dashboard/summary', {
        timeout: 45000,
      });
    } catch {
      // 401 is expected and confirms the backend is warm and accepting requests
    }
  });

  /**
   * Module 1: Login & Role Access
   * Sign in as Anush (anush@acmecorp.com / password123) and verify redirect to Dashboard;
   * also verify Sidharth, Nicholas, and Hitesh can sign in.
   */
  test('Module 1: Login & Role Access', async ({ page }) => {
    const networkErrors: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().includes('/api/auth/login')) {
        networkErrors.push(`${res.status()} ${res.statusText()} on ${res.url()}`);
      }
    });

    console.log('\n--- Testing Module 1: Login & Role Access ---');

    // 1. Sign in as Anush (Admin)
    console.log('Testing sign in for Anush (anush@acmecorp.com)...');
    await login(page, ACCOUNTS.anush.email, ACCOUNTS.anush.password);
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`));
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Anush', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(sidebar.getByText('Admin', { exact: true })).toBeVisible({ timeout: 15000 });
    console.log('PASS: Anush logged in successfully and redirected to Dashboard.');

    // 2. Sign in as Sidharth (HR)
    console.log('Testing sign in for Sidharth (sidharth@acmecorp.com)...');
    await login(page, ACCOUNTS.sidharth.email, ACCOUNTS.sidharth.password);
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`));
    await expect(page.locator('aside').getByText('Sidharth', { exact: true })).toBeVisible({ timeout: 15000 });
    console.log('PASS: Sidharth logged in successfully.');

    // 3. Sign in as Nicholas (Manager)
    console.log('Testing sign in for Nicholas (nicholas@acmecorp.com)...');
    await login(page, ACCOUNTS.nicholas.email, ACCOUNTS.nicholas.password);
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`));
    await expect(page.locator('aside').getByText('Nicholas', { exact: true })).toBeVisible({ timeout: 15000 });
    console.log('PASS: Nicholas logged in successfully.');

    // 4. Sign in as Hitesh (Employee)
    console.log('Testing sign in for Hitesh (hitesh@acmecorp.com)...');
    await login(page, ACCOUNTS.hitesh.email, ACCOUNTS.hitesh.password);
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`));
    await expect(page.locator('aside').getByText('Hitesh', { exact: true })).toBeVisible({ timeout: 15000 });
    console.log('PASS: Hitesh logged in successfully.');

    expect(networkErrors).toEqual([]);
  });

  /**
   * Module 2: Control Tower Dashboard
   * Verify executive metrics and workload chart render with zero HTTP 4xx/5xx API errors.
   */
  test('Module 2: Control Tower Dashboard', async ({ page }) => {
    console.log('\n--- Testing Module 2: Control Tower Dashboard ---');
    const apiErrors: string[] = [];

    page.on('response', (res) => {
      const url = res.url();
      if (res.status() >= 400 && (url.includes('/api/') || url.includes('onrender.com'))) {
        apiErrors.push(`${res.status()} ${res.statusText()} on ${url}`);
      }
    });

    // Sign in as Anush
    await login(page, ACCOUNTS.anush.email, ACCOUNTS.anush.password);

    // Wait for the Control Tower Executive Analytics heading
    await expect(
      page.getByText('Control Tower Executive Analytics')
    ).toBeVisible({ timeout: 20000 });

    // Verify Executive Metrics Cards render
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Overdue Tasks')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Tasks Completed')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pending Approvals')).toBeVisible({ timeout: 15000 });

    // Verify Workload Chart section renders
    await expect(page.getByText('Team Workload Distribution')).toBeVisible({ timeout: 15000 });
    const chartContainer = page.locator('.recharts-responsive-container');
    await expect(chartContainer.first()).toBeVisible({ timeout: 20000 });

    // Wait for API response to be fully processed and verify 0 API errors
    await page.waitForTimeout(2000);
    if (apiErrors.length > 0) {
      console.error('API Errors detected during Dashboard load:', apiErrors);
    }
    expect(apiErrors).toEqual([]);
    console.log('PASS: Control Tower Dashboard rendered metrics & charts with zero 4xx/5xx API errors.');
  });

  /**
   * Module 3: Knowledge Base (RAG)
   * Open /knowledge, click "Summarize Leave Policy", wait for AI response, and verify an answer renders instead of "Failed to fetch".
   */
  test('Module 3: Knowledge Base (RAG)', async ({ page }) => {
    console.log('\n--- Testing Module 3: Knowledge Base (RAG) ---');
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().includes('/api/knowledge')) {
        networkErrors.push(`${res.status()} ${res.statusText()} on ${res.url()}`);
      }
    });

    // Sign in as Anush
    await login(page, ACCOUNTS.anush.email, ACCOUNTS.anush.password);

    // Navigate to /knowledge
    await page.goto(`${BASE_URL}/knowledge`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for prompt chip "Summarize Leave Policy" (using .first() to target the primary hero chip)
    const chipButton = page.getByRole('button', { name: /Summarize Leave Policy/i }).first();
    await expect(chipButton).toBeVisible({ timeout: 20000 });

    console.log('Clicking "Summarize Leave Policy" chip...');
    await chipButton.click();

    // Verify user query appears in chat
    await expect(page.getByText('Summarize the SmartCorp annual PTO leave accrual')).toBeVisible({
      timeout: 10000,
    });

    // Wait for the AI response (up to 55s for Render and Gemini API)
    console.log('Waiting for Grounded AI response from backend...');
    const aiIndicator = page.locator('text=SmartCorp Grounded AI');
    await expect(aiIndicator.first()).toBeVisible({ timeout: 55000 });

    // Wait for assistant message container to be visible and populated
    const aiMessageContainer = page.locator('.max-w-2xl.bg-surface').first();
    await expect(aiMessageContainer).toBeVisible({ timeout: 15000 });

    const responseText = await aiMessageContainer.innerText();
    console.log(`Received AI Response (${responseText.length} chars):`, responseText.slice(0, 150) + '...');

    // Assert that response is NOT "Failed to fetch" or network error
    expect(responseText).not.toContain('Failed to fetch');
    expect(responseText).not.toContain('Error retrieving answer');
    expect(responseText.length).toBeGreaterThan(20);

    if (networkErrors.length > 0) {
      console.error('Network errors during RAG query:', networkErrors);
    }
    expect(networkErrors).toEqual([]);
    console.log('PASS: Knowledge Base returned valid grounded answer without "Failed to fetch".');
  });

  /**
   * Module 4: Meeting Converter & Task Board
   * Open /meetings, click "Load Sample Meeting Notes", click "Extract Action Items", publish to Task Board, reload /tasks, and confirm the task persists.
   */
  test('Module 4: Meeting Converter & Task Board', async ({ page }) => {
    console.log('\n--- Testing Module 4: Meeting Converter & Task Board ---');
    const apiErrors: string[] = [];

    page.on('response', (res) => {
      const url = res.url();
      if (res.status() >= 400 && (url.includes('/api/meetings') || url.includes('/api/tasks'))) {
        apiErrors.push(`${res.status()} ${res.statusText()} on ${url}`);
      }
    });

    // Sign in as Anush (Admin)
    await login(page, ACCOUNTS.anush.email, ACCOUNTS.anush.password);

    // Open /meetings
    console.log('Navigating to /meetings...');
    await page.goto(`${BASE_URL}/meetings`);
    await page.waitForLoadState('domcontentloaded');

    // Click "Load Sample Meeting Notes"
    const loadSampleButton = page.getByRole('button', { name: /Load Sample Meeting Notes/i });
    await expect(loadSampleButton).toBeVisible({ timeout: 15000 });
    await loadSampleButton.click();

    // Verify textarea contains sample notes
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue(/Sprint Planning & Operations Sync/i);
    console.log('PASS: Sample meeting notes loaded.');

    // Click "Extract Action Items"
    const extractButton = page.getByRole('button', { name: /Extract Action Items/i });
    await expect(extractButton).toBeEnabled();
    console.log('Clicking "Extract Action Items" and awaiting LLM extraction...');
    await extractButton.click();

    // Wait for extracted action items to appear (Publish button becomes visible)
    const publishButton = page.getByRole('button', { name: /Publish All to Task Board/i });
    await expect(publishButton).toBeVisible({ timeout: 55000 });
    console.log('PASS: Action items successfully extracted by Gemini.');

    // Publish to Task Board
    console.log('Clicking "Publish All to Task Board"...');
    await publishButton.click();

    // Verify publish success banner
    await expect(
      page.getByText(/Successfully published/i)
    ).toBeVisible({ timeout: 25000 });
    console.log('PASS: Action items published to PostgreSQL database.');

    // Navigate to /tasks
    console.log('Navigating to /tasks and verifying task persistence...');
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('domcontentloaded');

    // Reload /tasks to confirm database persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Confirm tasks persist on the Kanban board
    await expect(page.getByText('Live Task Board')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('To Do', { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify task cards exist
    const taskTitles = page.locator('h4');
    await expect(taskTitles.first()).toBeVisible({ timeout: 20000 });
    const count = await taskTitles.count();
    console.log(`Found ${count} persisted task titles on the Task Board.`);
    expect(count).toBeGreaterThan(0);

    if (apiErrors.length > 0) {
      console.error('API errors during Meeting Converter & Task Board test:', apiErrors);
    }
    expect(apiErrors).toEqual([]);
    console.log('PASS: Extracted tasks persisted across page reload on Task Board.');
  });

  /**
   * Module 5: Theme Switcher
   * Toggle Dark/Light mode and confirm the theme class updates.
   */
  test('Module 5: Theme Switcher', async ({ page }) => {
    console.log('\n--- Testing Module 5: Theme Switcher ---');

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');

    const html = page.locator('html');
    const toggleButton = page.locator('button[title*="mode"]').first();
    await expect(toggleButton).toBeVisible({ timeout: 15000 });

    // Check current theme
    const initialClasses = (await html.getAttribute('class')) || '';
    console.log('Initial html class attribute:', initialClasses);

    if (initialClasses.includes('dark')) {
      // Toggle to Light
      console.log('Toggling from Dark to Light mode...');
      await toggleButton.click();
      await expect(html).toHaveClass(/light/);
      console.log('PASS: Theme switched to Light (html has class "light").');

      // Toggle back to Dark
      console.log('Toggling back from Light to Dark mode...');
      await toggleButton.click();
      await expect(html).toHaveClass(/dark/);
      console.log('PASS: Theme switched back to Dark (html has class "dark").');
    } else {
      // Toggle to Dark
      console.log('Toggling to Dark mode...');
      await toggleButton.click();
      await expect(html).toHaveClass(/dark/);
      console.log('PASS: Theme switched to Dark (html has class "dark").');

      // Toggle back to Light
      console.log('Toggling back from Light to Dark mode...');
      await toggleButton.click();
      await expect(html).toHaveClass(/light/);
      console.log('PASS: Theme switched back to Light (html has class "light").');
    }
  });
});
