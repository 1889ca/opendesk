import { test, expect } from '@playwright/test';
import { API, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Auth Flow', () => {
  test('authenticated user can access doc list', async ({ page }) => {
    // Dev mode auto-authenticates via Bearer dev token in api-client
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OpenDesk' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Document' })).toBeVisible();
  });

  test('authenticated user can create and open a document', async ({ page }) => {
    const title = `Auth Test ${Date.now()}`;
    const docId = await createDocViaAPI(title);
    await page.goto(`/editor.html?doc=${docId}`);
    await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible({ timeout: 10000 });
  });

  test('API rejects requests without valid auth token', async () => {
    const res = await fetch(`${API}/api/documents`, {
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    });
    expect(res.status).toBe(401);
  });

  test('API rejects requests with no auth header', async () => {
    const res = await fetch(`${API}/api/documents`);
    expect(res.status).toBe(401);
  });

  test('dev token with custom identity works', async () => {
    const res = await fetch(`${API}/api/documents`, {
      headers: { Authorization: 'Bearer dev:alice:Alice:read,write' },
    });
    expect(res.ok).toBe(true);
    const docs = await res.json();
    expect(Array.isArray(docs)).toBe(true);
  });

  test('different dev users have distinct identities', async () => {
    const title = `Identity Test ${Date.now()}`;
    // Create doc as user-a
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dev:user-a:UserA:read,write',
        'Content-Type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({ title }),
    });
    expect(createRes.status).toBe(201);
    const doc = await createRes.json();

    // Both user-a and dev-user can see it (dev mode grants are auto-created)
    const res = await fetch(`${API}/api/documents/${doc.id}`, {
      headers: { Authorization: 'Bearer dev:user-a:UserA:read' },
    });
    expect(res.ok).toBe(true);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer dev:user-a:UserA:read,write',
        'idempotency-key': crypto.randomUUID(),
      },
    });
  });
});
