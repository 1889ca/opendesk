import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

/**
 * Permission enforcement (negative tests / IDOR prevention).
 * Verifies that users cannot access, modify, or delete resources
 * they have no grant for.
 */

/** Fetch helper with a specific user identity */
function authAs(userId: string, name = 'TestUser') {
  return { Authorization: `Bearer dev:${userId}:${name}:read,write` };
}

function readOnlyAuth(userId: string, name = 'ReadOnly') {
  return { Authorization: `Bearer dev:${userId}:${name}:read` };
}

test.describe('Permission Enforcement — Negative Tests', () => {
  test('user cannot read another user\'s document without a grant', async () => {
    // Create a document as user-owner
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...authAs('user-owner', 'Owner'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `Private Doc ${Date.now()}` }),
    });
    expect(createRes.status).toBe(201);
    const doc = await createRes.json();

    // A different user tries to read it — should be denied
    const readRes = await fetch(`${API}/api/documents/${doc.id}`, {
      headers: authAs('user-intruder', 'Intruder'),
    });
    // Expect 403 Forbidden (no grant for this user)
    expect([403, 404]).toContain(readRes.status);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-owner', 'Owner'), 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('user cannot update another user\'s document without write grant', async () => {
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...authAs('user-writer', 'Writer'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `No Write ${Date.now()}` }),
    });
    const doc = await createRes.json();

    // Another user tries to update
    const patchRes = await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { ...authAs('user-stranger', 'Stranger'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    expect([403, 404]).toContain(patchRes.status);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-writer', 'Writer'), 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('user cannot delete another user\'s document', async () => {
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...authAs('user-delowner', 'DelOwner'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `No Delete ${Date.now()}` }),
    });
    const doc = await createRes.json();

    // Another user tries to delete
    const deleteRes = await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-attacker', 'Attacker'), 'idempotency-key': crypto.randomUUID() },
    });
    expect([403, 404]).toContain(deleteRes.status);

    // Verify doc still exists for the owner
    const checkRes = await fetch(`${API}/api/documents/${doc.id}`, {
      headers: authAs('user-delowner', 'DelOwner'),
    });
    expect(checkRes.ok).toBe(true);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-delowner', 'DelOwner'), 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('user cannot export another user\'s document', async () => {
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...authAs('user-exportowner', 'ExportOwner'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `No Export ${Date.now()}` }),
    });
    const doc = await createRes.json();

    // Unauthorized user tries to export
    const exportRes = await fetch(`${API}/api/documents/${doc.id}/export`, {
      method: 'POST',
      headers: { ...authAs('user-noexport', 'NoExport'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html', content: '<p>steal</p>' }),
    });
    expect([403, 404]).toContain(exportRes.status);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-exportowner', 'ExportOwner'), 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('user cannot create share link without write permission', async () => {
    const createRes = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...authAs('user-shareowner', 'ShareOwner'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: `No Share ${Date.now()}` }),
    });
    const doc = await createRes.json();

    // Unauthorized user tries to create a share link
    const shareRes = await fetch(`${API}/api/documents/${doc.id}/share`, {
      method: 'POST',
      headers: { ...authAs('user-noshare', 'NoShare'), 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect([403, 404]).toContain(shareRes.status);

    // Cleanup
    await fetch(`${API}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { ...authAs('user-shareowner', 'ShareOwner'), 'idempotency-key': crypto.randomUUID() },
    });
  });

  test('non-existent document IDs return 404 not 500', async () => {
    const fakeId = 'idor-test-nonexistent-' + Date.now();

    const readRes = await fetch(`${API}/api/documents/${fakeId}`, {
      headers: AUTH,
    });
    expect(readRes.status).toBe(404);

    const patchRes = await fetch(`${API}/api/documents/${fakeId}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title: 'nope' }),
    });
    expect([404, 403]).toContain(patchRes.status);
  });
});
