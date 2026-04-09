import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

/** Create a share link via API and return the token */
async function createShareLink(
  docId: string,
  role = 'viewer',
  options: Record<string, unknown> = {},
): Promise<{ token: string; url: string }> {
  const res = await fetch(`${API}/api/documents/${docId}/share`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ role, options }),
  });
  expect(res.status).toBe(201);
  const link = await res.json();
  return { token: link.token, url: `/share.html?token=${link.token}` };
}

test.describe('Share Link — Create + Redeem', () => {
  test('create share link and resolve it', async () => {
    const docId = await createDocViaAPI(`Share Test ${Date.now()}`);
    const { token } = await createShareLink(docId);

    // Resolve the share link
    const res = await fetch(`${API}/api/share/${token}/resolve`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.grant.docId).toBe(docId);
    expect(data.grant.role).toBe('viewer');
  });

  test('share page resolves and redirects to editor', async ({ page }) => {
    const docId = await createDocViaAPI(`Share Redirect ${Date.now()}`);
    const { url } = await createShareLink(docId);

    await page.goto(url);
    // The share page should resolve and redirect to the editor
    await expect(page).toHaveURL(new RegExp(`editor\\.html\\?doc=${docId}`), { timeout: 10000 });
    await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible({ timeout: 10000 });
  });

  test('password-protected link requires password', async ({ page }) => {
    const docId = await createDocViaAPI(`Password Share ${Date.now()}`);
    const { token, url } = await createShareLink(docId, 'viewer', { password: 'secret123' });

    // Without password, resolve returns 403
    const noPassRes = await fetch(`${API}/api/share/${token}/resolve`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(noPassRes.status).toBe(403);

    // With wrong password, still 403
    const wrongRes = await fetch(`${API}/api/share/${token}/resolve`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(wrongRes.status).toBe(403);

    // With correct password, resolves
    const correctRes = await fetch(`${API}/api/share/${token}/resolve`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret123' }),
    });
    expect(correctRes.ok).toBe(true);
    const data = await correctRes.json();
    expect(data.grant.docId).toBe(docId);
  });

  test('password-protected share page shows password form', async ({ page }) => {
    const docId = await createDocViaAPI(`Password Page ${Date.now()}`);
    const { url } = await createShareLink(docId, 'viewer', { password: 'test456' });

    await page.goto(url);
    // Should show the password form
    await expect(page.locator('#password-form')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#password-input')).toBeVisible();

    // Enter the password and submit
    await page.locator('#password-input').fill('test456');
    await page.locator('#password-submit').click();

    // Should redirect to the editor
    await expect(page).toHaveURL(new RegExp(`editor\\.html\\?doc=${docId}`), { timeout: 10000 });
  });

  test('revoked share link returns error', async () => {
    const docId = await createDocViaAPI(`Revoke Test ${Date.now()}`);
    const { token } = await createShareLink(docId);

    // Revoke the link
    const revokeRes = await fetch(`${API}/api/share/${token}`, {
      method: 'DELETE',
      headers: { ...AUTH, 'idempotency-key': crypto.randomUUID() },
    });
    expect(revokeRes.ok).toBe(true);

    // Try to resolve — should fail
    const resolveRes = await fetch(`${API}/api/share/${token}/resolve`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(resolveRes.status).toBe(410);
  });
});
