/** Contract: scripts — esbuild watch mode for frontend bundles */
import * as esbuild from 'esbuild';

const sharedJS = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
};

const sharedCSS = {
  bundle: true,
};

const entries = [
  {
    ...sharedJS,
    entryPoints: ['modules/app/internal/editor/editor.ts'],
    outfile: 'modules/app/internal/public/editor.bundle.js',
    alias: { '@tiptap/y-tiptap': 'y-prosemirror' },
  },
  {
    ...sharedCSS,
    entryPoints: ['modules/app/internal/css/editor.css'],
    outfile: 'modules/app/internal/public/editor.bundle.css',
  },
  {
    ...sharedJS,
    entryPoints: ['modules/app/internal/doc-list/doc-list.ts'],
    outfile: 'modules/app/internal/public/doc-list.bundle.js',
  },
  {
    ...sharedCSS,
    entryPoints: ['modules/app/internal/css/doc-list.css'],
    outfile: 'modules/app/internal/public/doc-list.bundle.css',
  },
  {
    ...sharedJS,
    entryPoints: ['modules/app-sheets/internal/spreadsheet-editor.ts'],
    outfile: 'modules/app/internal/public/spreadsheet.bundle.js',
  },
  {
    ...sharedCSS,
    entryPoints: ['modules/app-sheets/internal/css/spreadsheet.css'],
    outfile: 'modules/app/internal/public/spreadsheet.bundle.css',
  },
  {
    ...sharedJS,
    entryPoints: ['modules/app-slides/internal/presentation-editor.ts'],
    outfile: 'modules/app/internal/public/presentation.bundle.js',
  },
  {
    ...sharedCSS,
    entryPoints: ['modules/app-slides/internal/css/presentation.css'],
    outfile: 'modules/app/internal/public/presentation.bundle.css',
  },
  {
    ...sharedJS,
    entryPoints: ['modules/app/internal/admin-dashboard.ts'],
    outfile: 'modules/app/internal/public/admin.bundle.js',
  },
  {
    ...sharedCSS,
    entryPoints: ['modules/app/internal/css/admin.css'],
    outfile: 'modules/app/internal/public/admin.bundle.css',
  },
  {
    ...sharedJS,
    entryPoints: ['modules/app/internal/share-resolve.ts'],
    outfile: 'modules/app/internal/public/share-resolve.bundle.js',
  },
];

const contexts = await Promise.all(
  entries.map((entry) => esbuild.context(entry)),
);

await Promise.all(contexts.map((ctx) => ctx.watch()));

console.log('[watch-frontend] watching all frontend entry points...');

process.on('SIGINT', async () => {
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
  process.exit(0);
});
