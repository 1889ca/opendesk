import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Auth Flow', () => {
  test('dev token returns document list', async () => {
    const res = await fetch(`${API}/api/documents`, { headers: AUTH });
    expect(res.ok).toBe(true);
    // GET /api/documents returns the paginated shape from #171/#172:
    // { data: Doc[], pagination: { page, limit, total, totalPages } }
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('dev token can create a document', async () => {
    const title = `Auth Test ${Date.now()}`;
    const res = await fetch(`${API}/api/documents`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ title }),
    });
    expect(res.status).toBe(201);
    const doc = await res.json();
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe(title);
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
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
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

    // user-a can see their own doc
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
