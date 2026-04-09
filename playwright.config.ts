import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    // Pre-seed localStorage so the first-visit name-setup modal
    // (modules/app/internal/shared/name-setup.ts, added in #170)
    // never shows during e2e runs. Without this seed, the modal
    // intercepts pointer events on every page load and breaks any
    // test that clicks UI elements (theme toggle, doc list, editor,
    // auth flow, …). The modal checks `opendesk:userNameConfirmed`;
    // when it's set to '1' the modal short-circuits and resolves
    // immediately. We also seed `opendesk:userName` so the auth
    // token has a stable identity for tests that exercise it.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3000',
          localStorage: [
            { name: 'opendesk:userNameConfirmed', value: '1' },
            { name: 'opendesk:userName', value: 'E2E Test User' },
          ],
        },
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
