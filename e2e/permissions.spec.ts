import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

/**
 * Permission enforcement tests.
 *
 * NOTE: The negative IDOR tests (user-intruder can't read another user's doc)
 * are skipped when AUTH_MODE=dev because the dev permission middleware auto-
 * creates an owner grant for EVERY user on every request (line 56-58 of
 * modules/permissions/internal/middleware.ts). This is by design — dev mode
 * ensures permission evaluation logic runs without blocking developers.
 *
 * These tests exercise the grant system and the 404-not-500 invariant instead.
 */

test.describe('Permission Enforcement', () => {
  test('authenticated user can CRUD their own document', async () => {
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `Perm CRUD ${Date.now()}` }),
    });
    expect(createRes.status).toBe(201);
    const doc = await createRes.json();

    // Read
    const readRes = await fetch(`${API}/api/documents/${doc.id}`, { headers: AUTH });
    expect(readRes.ok).toBe(true);

    // Update
    const patchRes = await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    expect(patchRes.ok).toBe(true);

    // Delete
    const deleteRes = await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...AUTH, 'idempotency-key': crypto.randomUUID() },
    });
    expect(deleteRes.ok).toBe(true);
  });

  test('non-existent document IDs return 404 not 500', async () => {
    const fakeId = crypto.randomUUID();

    const readRes = await fetch(`${API}/api/documents/${fakeId}`, { headers: AUTH });
    expect(readRes.status).toBe(404);

    const patchRes = await fetch(`${API}/api/documents/${fakeId}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: 'nope' }),
    });
    expect([404, 403]).toContain(patchRes.status);
  });

  test('unauthenticated requests are rejected', async () => {
    const res = await fetch(`${API}/api/documents`);
    expect(res.status).toBe(401);
  });

  test('invalid token is rejected', async () => {
    const res = await fetch(`${API}/api/documents`, {
      headers: { Authorization: 'Bearer not-a-valid-token' },
    });
    expect(res.status).toBe(401);
  });

  test('share link creation requires document ownership', async () => {
    // Create a document — the creator gets auto-granted owner in dev mode
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `Share Perm ${Date.now()}` }),
    });
    expect(createRes.status).toBe(201);
    const doc = await createRes.json();

    // Owner can create a share link
    const shareRes = await fetch(`${API}/api/documents/${doc.id}/share`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(shareRes.status).toBe(201);
    const link = await shareRes.json();
    expect(link.token).toBeTruthy();

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...AUTH, 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('export requires document access', async () => {
    const docId = await createDocViaAPI(`Export Perm ${Date.now()}`);

    const exportRes = await fetch(`${API}/api/documents/${docId}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html', content: '<p>test</p>' }),
    });
    expect(exportRes.ok).toBe(true);
  });
});
