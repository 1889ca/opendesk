import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'modules/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    globals: true,
  },
});
