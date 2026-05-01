import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const AUTH = { Authorization: 'Bearer dev' };

/** Create a document via API and return its ID */
async function createDocViaAPI(title = 'E2E Test Doc'): Promise<string> {
  const res = await fetch(`${API}/api/documents`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ title }),
  });
  const doc = await res.json();
  return doc.id;
}

/** Navigate to editor for a specific document */
async function openEditor(page: Page, docId: string) {
  await page.goto(`/editor.html?doc=${docId}`);
  await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible({ timeout: 10000 });
}

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

test.describe('Editor', () => {
  let docId: string;

  test.beforeEach(async () => {
    docId = await createDocViaAPI(`Editor Test ${Date.now()}`);
  });

  test('loads with full toolbar', async ({ page }) => {
    await openEditor(page, docId);
    await expect(page.getByRole('button', { name: 'Bold' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Italic' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bullet list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Insert table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emoji' })).toBeVisible();
  });

  test('content area and status bar present', async ({ page }) => {
    await openEditor(page, docId);
    await expect(page.getByRole('main', { name: 'Document editor' })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('type text and see word count', async ({ page }) => {
    await openEditor(page, docId);
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.type('Hello from the E2E test suite');
    await expect(editor).toContainText('Hello from the E2E test suite');
    await expect(page.getByRole('status')).toContainText('6 words', { timeout: 5000 });
  });

  test('bold formatting via keyboard shortcut', async ({ page }) => {
    await openEditor(page, docId);
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.type('normal ');
    await page.keyboard.press('Meta+b');
    await page.keyboard.type('bold');
    await page.keyboard.press('Meta+b');
    await expect(editor.locator('strong')).toContainText('bold');
  });

  test('italic formatting via keyboard shortcut', async ({ page }) => {
    await openEditor(page, docId);
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.press('Meta+i');
    await page.keyboard.type('italic');
    await page.keyboard.press('Meta+i');
    await expect(editor.locator('em')).toContainText('italic');
  });

  test('heading via toolbar button', async ({ page }) => {
    await openEditor(page, docId);
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.type('My Heading');
    // Select all text, then apply heading
    await page.keyboard.press('Meta+a');
    await page.getByRole('button', { name: 'Heading 1' }).click();
    await expect(editor.locator('h1')).toContainText('My Heading');
  });

  test('export buttons present', async ({ page }) => {
    await openEditor(page, docId);
    await expect(page.getByRole('button', { name: 'HTML' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();
  });

  test('table of contents panel toggles', async ({ page }) => {
    await openEditor(page, docId);
    const tocBtn = page.getByRole('button', { name: 'Table of Contents' });
    await tocBtn.click();
    const toc = page.getByRole('navigation', { name: 'Table of Contents' });
    await expect(toc).toBeVisible();
  });

  test('language switcher works', async ({ page }) => {
    await openEditor(page, docId);
    const langSelect = page.locator('select').first();
    await langSelect.selectOption('fr');
    await page.waitForTimeout(300);
    // Switch back
    await langSelect.selectOption('en');
    await page.waitForTimeout(300);
  });

  test('back link returns to doc list', async ({ page }) => {
    await openEditor(page, docId);
    await page.getByRole('link', { name: 'Back to documents' }).click();
    await expect(page).toHaveURL('/');
  });

  test('content persists after reload', async ({ page }) => {
    await openEditor(page, docId);
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.type('Persistent content');
    await expect(editor).toContainText('Persistent content');
    // Wait for WebSocket sync
    await page.waitForTimeout(2000);
    // Reload
    await page.reload();
    await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.editor-content')).toContainText('Persistent content');
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await openEditor(page, docId);
    await page.waitForTimeout(2000);
    const real = errors.filter(e => !e.includes('favicon'));
    expect(real).toHaveLength(0);
  });
});

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
