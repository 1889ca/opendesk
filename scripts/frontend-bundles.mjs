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
 *
 * Migration in progress (modules/core/manifest): bundles owned by a
 * registered manifest are pulled in from the registry below. The
 * legacy hand-coded list still holds bundles for modules that have
 * not yet been migrated to a manifest. As each module gets a
 * manifest its entries are deleted from the hand-coded list (no
 * zombie code).
 */

import { tsImport } from 'tsx/esm/api';

const OUTDIR = 'modules/app/internal/public';

/**
 * @typedef {Object} BundleEntry
 * @property {'js'|'css'} kind
 * @property {string} entryPoint
 * @property {string} outfile
 * @property {Record<string,string>=} alias
 */

// Bundles owned by modules that have NOT yet been migrated to a
// manifest. As modules migrate they move out of this list and into
// their own modules/<name>/manifest.ts.
/** @type {BundleEntry[]} */
const legacyBundles = [
  // SPA shell (spa.html)
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/shell/main.ts',
    outfile: `${OUTDIR}/shell.bundle.js`,
    alias: {
      '@opendesk/app': './modules/app/index.ts',
      '@opendesk/app-kb': './modules/app-kb/index.ts',
    },
  },

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

  // (workflows: now owned by modules/workflow/manifest.ts)

  // Knowledge Base browser
  {
    kind: 'js',
    entryPoint: 'modules/app/internal/kb-browser/kb-browser.ts',
    outfile: `${OUTDIR}/kb-browser.bundle.js`,
  },
  {
    kind: 'css',
    entryPoint: 'modules/app/internal/css/kb-browser.css',
    outfile: `${OUTDIR}/kb-browser.bundle.css`,
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
 * Pull frontend bundle declarations out of every registered module
 * manifest. Manifests are TypeScript so we go through tsx's
 * programmatic ESM API — that lets the build/watch scripts stay
 * plain Node ESM (no loader flag required) while still reading the
 * canonical typed registry.
 *
 * The manifest stores `outfile` as a bare filename; this loader
 * prepends OUTDIR so the result matches the legacy list shape that
 * `toEsbuildOptions` consumes.
 *
 * @returns {Promise<BundleEntry[]>}
 */
async function loadManifestBundles() {
  const mod = await tsImport('../modules/core/manifest/index.ts', import.meta.url);
  /** @type {Array<{name: string, frontend?: {bundles?: BundleEntry[]}}>} */
  const manifests = mod.manifests ?? [];
  return manifests.flatMap((m) =>
    (m.frontend?.bundles ?? []).map((b) => ({
      kind: b.kind,
      entryPoint: b.entryPoint,
      outfile: `${OUTDIR}/${b.outfile}`,
      ...(b.alias ? { alias: b.alias } : {}),
    })),
  );
}

/**
 * The merged bundle list: legacy hand-coded entries followed by
 * everything contributed by the manifest registry. Top-level await
 * is required so importers receive the resolved array directly.
 *
 * @type {BundleEntry[]}
 */
export const bundles = [...legacyBundles, ...(await loadManifestBundles())];

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
