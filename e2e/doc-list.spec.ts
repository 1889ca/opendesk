import { test, expect } from '@playwright/test';
import { createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Doc List Page', () => {
  test('loads with header and search', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OpenDesk' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search documents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Document' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Folder' })).toBeVisible();
  });

  test('shows created documents', async ({ page }) => {
    const title = `Listed Doc ${Date.now()}`;
    await createDocViaAPI(title);
    await page.goto('/');
    await expect(page.getByText(title)).toBeVisible({ timeout: 5000 });
  });

  test('clicking a document navigates to editor', async ({ page }) => {
    const title = `Clickable ${Date.now()}`;
    const docId = await createDocViaAPI(title);
    await page.goto('/');
    await page.getByText(title).click();
    await expect(page).toHaveURL(new RegExp(`editor\\.html\\?doc=${docId}`));
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForTimeout(1000);
    const real = errors.filter(e => !e.includes('favicon'));
    expect(real).toHaveLength(0);
  });
});
