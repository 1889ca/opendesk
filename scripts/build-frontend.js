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
  // Spreadsheet JS (app-sheets module)
  {
    entryPoints: ['modules/app-sheets/internal/spreadsheet-editor.ts'],
  // Spreadsheet JS
    entryPoints: ['modules/app/internal/spreadsheet-editor.ts'],
    outfile: `${OUTDIR}/spreadsheet.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Spreadsheet CSS (app-sheets module)
  {
    entryPoints: ['modules/app-sheets/internal/css/spreadsheet.css'],
  // Spreadsheet CSS
    entryPoints: ['modules/app/internal/css/spreadsheet.css'],
    outfile: `${OUTDIR}/spreadsheet.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Presentation JS (app-slides module)
  {
    entryPoints: ['modules/app-slides/internal/presentation-editor.ts'],
  // Presentation JS
    entryPoints: ['modules/app/internal/presentation-editor.ts'],
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
  // Presentation CSS
    entryPoints: ['modules/app/internal/css/presentation.css'],
    outfile: `${OUTDIR}/presentation.bundle.css`,
    bundle: true,
    minify: true,
    sourcemap: true,
  },
  // Admin dashboard JS (app-admin module)
  {
    entryPoints: ['modules/app-admin/internal/admin-dashboard.ts'],
    outfile: `${OUTDIR}/admin.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Admin dashboard CSS (app-admin module)
  {
    entryPoints: ['modules/app-admin/internal/css/admin.css'],
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
  // Workflow editor JS
  {
    entryPoints: ['modules/app/internal/workflows/workflow-page.ts'],
    outfile: `${OUTDIR}/workflows.bundle.js`,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  // Workflow editor CSS
  {
    entryPoints: ['modules/app/internal/css/workflows.css'],
    outfile: `${OUTDIR}/workflows.bundle.css`,
    bundle: true,
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
