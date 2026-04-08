import { test, expect } from '@playwright/test';
import { createDocViaAPI, openEditor, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

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
    await page.keyboard.press('Meta+a');
    await page.getByRole('button', { name: 'Heading 1' }).click();
    await expect(editor.locator('h1')).toContainText('My Heading');
  });

  test('export buttons present', async ({ page }) => {
    await openEditor(page, docId);
    await expect(page.getByRole('button', { name: 'HTML' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DOCX' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ODT' })).toBeVisible();
    await expect(page.getByTitle('Import .docx, .odt, or .pdf')).toBeVisible();
  });

  test('share dialog opens and creates link', async ({ page }) => {
    await openEditor(page, docId);
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.locator('.share-dialog')).toBeVisible();
    await expect(page.locator('#share-role')).toBeVisible();
    await page.getByRole('button', { name: 'Create link' }).click();
    await expect(page.locator('#share-url')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#share-url')).not.toHaveValue('', { timeout: 5000 });
    const url = await page.locator('#share-url').inputValue();
    expect(url).toContain('/share.html?token=');
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
    await page.waitForTimeout(2000);
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
