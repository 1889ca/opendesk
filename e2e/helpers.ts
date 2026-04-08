import { expect, type Page } from '@playwright/test';

export const API = 'http://localhost:3000';
export const AUTH = { Authorization: 'Bearer dev' };

/** Track all documents created during tests for cleanup. */
export const createdDocIds: string[] = [];

/** Create a document via API and return its ID */
export async function createDocViaAPI(title = 'E2E Test Doc'): Promise<string> {
  const res = await fetch(`${API}/api/documents`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ title }),
  });
  const doc = await res.json();
  createdDocIds.push(doc.id);
  return doc.id;
}

/** Delete a document via API (best-effort, ignores errors). */
export async function deleteDocViaAPI(docId: string): Promise<void> {
  await fetch(`${API}/api/documents/${docId}`, {
    method: 'DELETE',
    headers: { ...AUTH, 'idempotency-key': crypto.randomUUID() },
  }).catch(() => {});
}

/** Navigate to editor for a specific document */
export async function openEditor(page: Page, docId: string) {
  await page.goto(`/editor.html?doc=${docId}`);
  await expect(page.getByRole('toolbar', { name: 'Formatting toolbar' })).toBeVisible({ timeout: 10000 });
}

/** Clean up all tracked documents. Call from test.afterAll. */
export async function cleanupDocs() {
  for (const id of createdDocIds) {
    await deleteDocViaAPI(id);
  }
  createdDocIds.length = 0;
}
