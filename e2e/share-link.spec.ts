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

  test('password-protected link requires password', async () => {
    const docId = await createDocViaAPI(`Password Share ${Date.now()}`);
    const { token } = await createShareLink(docId, 'viewer', { password: 'secret123' });

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

  test('share page loads for valid token', async ({ page }) => {
    const docId = await createDocViaAPI(`Share Page ${Date.now()}`);
    const { url } = await createShareLink(docId);

    const response = await page.goto(url);
    // The share page should load (200) — it either redirects to editor
    // or shows a resolution UI
    expect(response?.ok()).toBe(true);
  });
});
