/** Contract: scripts — esbuild watch mode for frontend bundles */

/**
 * Dev watch mode counterpart to build-frontend.js. Bundle list lives
 * in frontend-bundles.mjs and is shared between the two so the
 * dev/prod paths can never drift again (the bug fixed by issue #137
 * was caused by exactly that drift).
 */

import * as esbuild from 'esbuild';
import { bundles, toEsbuildOptions } from './frontend-bundles.mjs';

const watchOptions = bundles.map((entry) =>
  toEsbuildOptions(entry, { minify: false, sourcemap: false }),
);

const contexts = await Promise.all(
  watchOptions.map((opts) => esbuild.context(opts)),
);

await Promise.all(contexts.map((ctx) => ctx.watch()));

console.log(`[watch-frontend] watching ${contexts.length} entry points...`);

async function shutdown() {
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
