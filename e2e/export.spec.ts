import { test, expect } from '@playwright/test';
import { API, AUTH, createDocViaAPI, cleanupDocs } from './helpers';

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

  test('export for non-existent document returns error', async () => {
    const res = await fetch(`${API}/api/documents/${crypto.randomUUID()}/export`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ format: 'html', content: '<p>test</p>' }),
    });
    // May return 404 (not found) or 403 (no grant) depending on middleware order
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
