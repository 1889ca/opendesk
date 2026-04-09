/**
 * Single source of truth for frontend bundle entry points.
 *
 * Both scripts/build-frontend.js (production build) and
 * scripts/watch-frontend.mjs (dev watch mode) import this list so
 * the two stay in sync. Previously each script declared its own
 * inline list, and watch-frontend.mjs developed a duplicate-key
 * typo (issue #137) that silently swapped the new app-sheets /
 * app-slides paths back to legacy modules/app/internal/ paths.
 *
 * Each entry has:
 *   kind:        'js' | 'css'
 *   entryPoint:  the source file
 *   outfile:     the bundled output (relative to repo root)
 *   alias?:      esbuild alias map (optional, JS only)
 */

const OUTDIR = 'modules/app/internal/public';

/**
 * @typedef {Object} BundleEntry
 * @property {'js'|'css'} kind
 * @property {string} entryPoint
 * @property {string} outfile
 * @property {Record<string,string>=} alias
 */

/** @type {BundleEntry[]} */
export const bundles = [
  // Editor
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/editor/editor.ts',
    outfile: `${OUTDIR}/editor.bundle.js`,
    alias: { '@tiptap/y-tiptap': 'y-prosemirror' },
  },
  {
    kind: 'css',
    entryPoint: 'modules/app/internal/css/editor.css',
    outfile: `${OUTDIR}/editor.bundle.css`,
  },

  // Doc list
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/doc-list/doc-list.ts',
    outfile: `${OUTDIR}/doc-list.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app/internal/css/doc-list.css',
    outfile: `${OUTDIR}/doc-list.bundle.css`,
  },

  // Spreadsheet (app-sheets module)
  {
    kind: 'js',
    entryPoint: 'modules/app-sheets/internal/spreadsheet-editor.ts',
    outfile: `${OUTDIR}/spreadsheet.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app-sheets/internal/css/spreadsheet.css',
    outfile: `${OUTDIR}/spreadsheet.bundle.css`,
  },

  // Presentation (app-slides module)
  {
    kind: 'js',
    entryPoint: 'modules/app-slides/internal/presentation-editor.ts',
    outfile: `${OUTDIR}/presentation.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app-slides/internal/css/presentation.css',
    outfile: `${OUTDIR}/presentation.bundle.css`,
  },

  // Admin dashboard (app-admin module)
  {
    kind: 'js',
    entryPoint: 'modules/app-admin/internal/admin-dashboard.ts',
    outfile: `${OUTDIR}/admin.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app-admin/internal/css/admin.css',
    outfile: `${OUTDIR}/admin.bundle.css`,
  },

  // Share resolve
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/share-resolve.ts',
    outfile: `${OUTDIR}/share-resolve.bundle.js`,
  },

  // Workflows
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/workflows/workflow-page.ts',
    outfile: `${OUTDIR}/workflows.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app/internal/css/workflows.css',
    outfile: `${OUTDIR}/workflows.bundle.css`,
  },

  // Admin models
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/admin-models/admin-models.ts',
    outfile: `${OUTDIR}/admin-models.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app/internal/css/admin-models.css',
    outfile: `${OUTDIR}/admin-models.bundle.css`,
  },
];

/**
 * Build esbuild options for a single bundle entry.
 *
 * @param {BundleEntry} entry
 * @param {{ minify?: boolean; sourcemap?: boolean }} opts
 * @returns {import('esbuild').BuildOptions}
 */
export function toEsbuildOptions(entry, opts = {}) {
  /** @type {import('esbuild').BuildOptions} */
  const base = {
    entryPoints: [entry.entryPoint],
    outfile: entry.outfile,
    bundle: true,
    minify: opts.minify ?? false,
    sourcemap: opts.sourcemap ?? false,
  };

  if (entry.kind === 'js') {
    base.format = 'esm';
    base.target = 'es2022';
    if (entry.alias) base.alias = entry.alias;
  }

  return base;
}
