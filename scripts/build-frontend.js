#!/usr/bin/env node
/** Contract: contracts/app/rules.md */

/**
 * Parallel frontend build script using esbuild.
 * Bundles JS + CSS for each entry point concurrently.
 *
 * Bundle list lives in scripts/frontend-bundles.mjs and is shared
 * with scripts/watch-frontend.mjs (issue #137).
 */

import * as esbuild from 'esbuild';
import { bundles, toEsbuildOptions } from './frontend-bundles.mjs';

const builds = bundles.map((entry) =>
  toEsbuildOptions(entry, { minify: true, sourcemap: true }),
);

async function main() {
  const t0 = performance.now();
  const results = await Promise.all(builds.map((opts) => esbuild.build(opts)));

  const errors = results.flatMap((r) => r.errors);
  if (errors.length) {
    console.error('Build failed with errors:', errors);
    process.exit(1);
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`Built ${builds.length} bundles in ${elapsed}s`);
}

main();
