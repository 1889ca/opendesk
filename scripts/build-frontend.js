#!/usr/bin/env node
/** Contract: contracts/app/rules.md */

/**
 * Parallel frontend build script using esbuild.
 * Bundles JS + CSS for each entry point concurrently.
 */

import * as esbuild from 'esbuild';

const OUTDIR = 'modules/app/internal/public';

/** @type {esbuild.BuildOptions[]} */
const builds = [
  // Editor JS
  {
    entryPoints: ['modules/app/internal/editor/editor.ts'],
    outfile: `${OUTDIR}/editor.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
    alias: { '@tiptap/y-tiptap': 'y-prosemirror' },
  },
  // Editor CSS
  {
    entryPoints: ['modules/app/internal/css/editor.css'],
    outfile: `${OUTDIR}/editor.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Doc list JS
  {
    entryPoints: ['modules/app/internal/doc-list/doc-list.ts'],
    outfile: `${OUTDIR}/doc-list.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Doc list CSS
  {
    entryPoints: ['modules/app/internal/css/doc-list.css'],
    outfile: `${OUTDIR}/doc-list.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Spreadsheet JS
  {
    entryPoints: ['modules/app/internal/spreadsheet-editor.ts'],
    outfile: `${OUTDIR}/spreadsheet.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Spreadsheet CSS
  {
    entryPoints: ['modules/app/internal/css/spreadsheet.css'],
    outfile: `${OUTDIR}/spreadsheet.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Presentation JS (app-slides module)
  {
    entryPoints: ['modules/app-slides/internal/presentation-editor.ts'],
    outfile: `${OUTDIR}/presentation.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Presentation CSS (app-slides module)
  {
    entryPoints: ['modules/app-slides/internal/css/presentation.css'],
    outfile: `${OUTDIR}/presentation.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Admin dashboard JS
  {
    entryPoints: ['modules/app/internal/admin-dashboard.ts'],
    outfile: `${OUTDIR}/admin.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Admin dashboard CSS
  {
    entryPoints: ['modules/app/internal/css/admin.css'],
    outfile: `${OUTDIR}/admin.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Share resolve JS
  {
    entryPoints: ['modules/app/internal/share-resolve.ts'],
    outfile: `${OUTDIR}/share-resolve.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
];

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
