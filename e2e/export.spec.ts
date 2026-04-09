import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, openEditor, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Document Export', () => {
  test('export as HTML via API', async () => {
    const docId = await createDocViaAPI(`Export HTML ${Date.now()}`);
    const content = '<p>Test export content</p>';

    const res = await fetch(`${API}/api/documents/${docId}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html', content }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const body = await res.text();
    expect(body).toContain('Test export content');
  });

  test('export as plain text via API', async () => {
    const docId = await createDocViaAPI(`Export Text ${Date.now()}`);
    const content = '<p>Plain text <strong>export</strong> test</p>';

    const res = await fetch(`${API}/api/documents/${docId}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'text', content }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('Plain text');
    expect(body).toContain('export');
    // HTML tags should be stripped
    expect(body).not.toContain('<p>');
    expect(body).not.toContain('<strong>');
  });

  test('export rejects invalid format', async () => {
    const docId = await createDocViaAPI(`Export Invalid ${Date.now()}`);

    const res = await fetch(`${API}/api/documents/${docId}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'pdf', content: '<p>test</p>' }),
    });
    expect(res.status).toBe(400);
  });

  test('export rejects missing content', async () => {
    const docId = await createDocViaAPI(`Export NoContent ${Date.now()}`);

    const res = await fetch(`${API}/api/documents/${docId}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html' }),
    });
    expect(res.status).toBe(400);
  });

  test('export buttons trigger download in browser', async ({ page }) => {
    const docId = await createDocViaAPI(`Export Browser ${Date.now()}`);
    await openEditor(page, docId);

    // Type some content first
    const editor = page.locator('.editor-content');
    await editor.click();
    await page.keyboard.type('Export this content');
    await expect(editor).toContainText('Export this content');

    // Verify export buttons are visible
    await expect(page.getByRole('button', { name: 'HTML' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DOCX' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ODT' })).toBeVisible();

    // Click HTML export and verify download starts
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.getByRole('button', { name: 'HTML' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.html$/);
  });

  test('export for non-existent document returns 404', async () => {
    const res = await fetch(`${API}/api/documents/nonexistent-id-xyz/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html', content: '<p>test</p>' }),
    });
    expect(res.status).toBe(404);
  });
});
