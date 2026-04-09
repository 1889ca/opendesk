import { test, expect } from '@playwright/test';
import { createDocViaAPI, openEditor, cleanupDocs } from './helpers';

test.afterAll(async () => { await cleanupDocs(); });

test.describe('Multi-User Collaborative Edit', () => {
  test('two users can co-edit and see each other\'s changes', async ({ browser }) => {
    const docId = await createDocViaAPI(`Collab Test ${Date.now()}`);

    // Create two independent browser contexts (simulates two users)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Both users open the same document
      await openEditor(pageA, docId);
      await openEditor(pageB, docId);

      // User A types some text
      const editorA = pageA.locator('.editor-content');
      await editorA.click();
      await pageA.keyboard.type('Hello from User A');

      // Wait for CRDT sync — User B should see User A's text
      const editorB = pageB.locator('.editor-content');
      await expect(editorB).toContainText('Hello from User A', { timeout: 10000 });

      // User B types additional text
      await editorB.click();
      await pageB.keyboard.press('End');
      await pageB.keyboard.type(' and User B says hi');

      // User A should see the combined text
      await expect(editorA).toContainText('User B says hi', { timeout: 10000 });

      // Both editors should contain the full text
      await expect(editorA).toContainText('Hello from User A');
      await expect(editorB).toContainText('Hello from User A');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('formatting syncs between users', async ({ browser }) => {
    const docId = await createDocViaAPI(`Format Sync ${Date.now()}`);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await openEditor(pageA, docId);
      await openEditor(pageB, docId);

      // User A types and bolds text
      const editorA = pageA.locator('.editor-content');
      await editorA.click();
      await pageA.keyboard.press('Meta+b');
      await pageA.keyboard.type('Bold text');
      await pageA.keyboard.press('Meta+b');

      // User B should see the bold text via CRDT sync
      const editorB = pageB.locator('.editor-content');
      await expect(editorB.locator('strong')).toContainText('Bold text', { timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('content persists after both users disconnect', async ({ browser }) => {
    const docId = await createDocViaAPI(`Persist Collab ${Date.now()}`);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await openEditor(pageA, docId);

    const editorA = pageA.locator('.editor-content');
    await editorA.click();
    await pageA.keyboard.type('Persistent collab content');
    await expect(editorA).toContainText('Persistent collab content');

    // Wait for sync to server
    await pageA.waitForTimeout(2000);
    await contextA.close();

    // New user opens the same doc and sees the content
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await openEditor(pageB, docId);

    await expect(pageB.locator('.editor-content')).toContainText('Persistent collab content', { timeout: 10000 });
    await contextB.close();
  });
});
