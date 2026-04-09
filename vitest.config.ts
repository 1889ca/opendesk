import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'modules/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    // Runs once before any worker. Bootstraps the integration test
    // database (migrations + RLS role) so per-worker test files
    // don't race on setup. Opt-in via OPENDESK_TEST_PG=1; otherwise
    // it short-circuits as a no-op. See tests/integration/global-setup.ts.
    globalSetup: ['./tests/integration/global-setup.ts'],
  },
});
