import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Doc List', () => {
  test('doc list API returns array', async () => {
    const res = await fetch(`${API}/api/documents`, { headers: AUTH });
    expect(res.ok).toBe(true);
    const docs = await res.json();
    expect(Array.isArray(docs)).toBe(true);
  });

  test('created document appears in API list', async () => {
    const title = `Listed Doc ${Date.now()}`;
    await createDocViaAPI(title);

    const res = await fetch(`${API}/api/documents`, { headers: AUTH });
    const docs = await res.json();
    const found = docs.some((d: { title: string }) => d.title === title);
    expect(found).toBe(true);
  });

  test('SPA page loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    expect(response?.headers()['content-type']).toContain('text/html');
  });

  test('doc list page serves valid HTML with scripts', async ({ page }) => {
    await page.goto('/');
    // Verify the page has a script tag (shell.bundle.js loads the SPA)
    const scripts = await page.locator('script[src]').count();
    expect(scripts).toBeGreaterThan(0);
  });
});
