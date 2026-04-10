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
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { bundles, toEsbuildOptions } from './frontend-bundles.mjs';

const PUBLIC_DIR = 'modules/app/internal/public';

/**
 * Every HTML page that loads a stylesheet must include theme-init.js as
 * a synchronous <script> before any <link> tags. Without it, data-theme
 * is never set and the page renders without dark-mode styles.
 *
 * This check runs at build time so the mistake is caught immediately —
 * a new page cannot ship without it.
 */
function checkThemeInit() {
  const htmlFiles = readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html'));
  const missing = htmlFiles.filter((file) => {
    const content = readFileSync(join(PUBLIC_DIR, file), 'utf8');
    return content.includes('<link rel="stylesheet"') && !content.includes('theme-init.js');
  });

  if (missing.length) {
    console.error(
      '\nBuild error: the following pages load CSS but are missing <script src="theme-init.js">:\n' +
        missing.map((f) => `  - ${f}`).join('\n') +
        '\n\nAdd <script src="theme-init.js"></script> to <head> (before any <link>) in each file.\n',
    );
    process.exit(1);
  }
}

const builds = bundles.map((entry) =>
  toEsbuildOptions(entry, { minify: true, sourcemap: true }),
);

async function main() {
  checkThemeInit();
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
