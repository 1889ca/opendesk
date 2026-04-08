import { test, expect } from '@playwright/test';
import { createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Theme', () => {
  test('toggle persists across pages', async ({ page }) => {
    await page.goto('/');
    const themeBtn = page.getByRole('button', { name: /Theme/ });
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBeTruthy();

      // Navigate to editor and check theme persists
      const docId = await createDocViaAPI('Theme Test');
      await page.goto(`/editor.html?doc=${docId}`);
      const editorTheme = await page.locator('html').getAttribute('data-theme');
      expect(editorTheme).toBe(theme);
    }
  });
});
