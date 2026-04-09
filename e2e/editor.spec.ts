import { test, expect } from '@playwright/test';
import { createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

/**
 * Editor tests. The TipTap+Yjs editor requires WebSocket (Hocuspocus)
 * to initialize. In CI, the CRDT provider connection may be slow.
 * Tests use generous timeouts and skip if the toolbar never appears.
 */
test.describe('Editor', () => {
  let docId: string;

  test.beforeEach(async () => {
    docId = await createDocViaAPI(`Editor Test ${Date.now()}`);
  });

  test('editor page loads and serves HTML', async ({ page }) => {
    const response = await page.goto(`/editor.html?doc=${docId}`);
    expect(response?.ok()).toBe(true);
    expect(response?.headers()['content-type']).toContain('text/html');
  });

  test('editor initializes with toolbar', async ({ page }) => {
    await page.goto(`/editor.html?doc=${docId}`);
    // The toolbar may take time to appear while Yjs connects
    const toolbar = page.getByRole('toolbar', { name: 'Formatting toolbar' });
    const visible = await toolbar.isVisible().catch(() => false);
    if (!visible) {
      // Wait up to 15s for WebSocket + CRDT init
      await expect(toolbar).toBeVisible({ timeout: 15000 });
    }
    await expect(page.getByRole('button', { name: 'Bold' })).toBeVisible();
  });

  test('editor content area present', async ({ page }) => {
    await page.goto(`/editor.html?doc=${docId}`);
    const toolbar = page.getByRole('toolbar', { name: 'Formatting toolbar' });
    await expect(toolbar).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('main', { name: 'Document editor' })).toBeVisible();
  });
});
