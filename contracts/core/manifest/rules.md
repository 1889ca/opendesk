# Contract: core/manifest

## Purpose

Provide a typed registration surface so feature modules can declare the API routes, frontend bundles, and lifecycle hooks they contribute to the composed application — eliminating the previous god-function pattern in `modules/api/internal/create-routes.ts` where every module had to be hand-imported and hand-mounted from the composition root.

## Inputs

- `manifests`: `OpenDeskManifest[]` — central array in `modules/core/manifest/registry.ts` listing every module that wants to participate in composition
- `ctx`: `AppContext` — composition-root-built dependency-injection bundle (express app, config, pool, auth, permissions, hocuspocus, eventBus, audit, workflow, observability, sharing primitives, public dir, plus a service registry for cross-hook handles)
- Each manifest's `enabled?(config): boolean` — optional runtime gate evaluated once at startup
- Each manifest's `apiRoutes[]` — `{ mount, order?, factory }` declarations describing routers to mount on `ctx.app`
- Each manifest's `frontend.bundles[]` — `{ kind, entryPoint, outfile, alias? }` declarations consumed by the build script
- Each manifest's `lifecycle.onStart(ctx)` / `lifecycle.onShutdown(handle, ctx)` — optional async hooks for modules that own a long-lived resource

## Outputs

- `mountManifestRoutes(ctx, manifests)` — mounts every enabled manifest's routes onto `ctx.app` in `order`-sorted sequence
- `runManifestStartHooks(ctx, manifests)` → `ManifestStartHandle[]` — start handles to be passed back during shutdown
- `runManifestShutdownHooks(ctx, handles)` — runs `onShutdown` for each started manifest in reverse order
- `collectManifestBundles(manifests)` → `FrontendBundleSpec[]` — flat list consumed by `scripts/frontend-bundles.mjs`
- `createServiceRegistry()` — returns the `register` / `get` pair the composition root folds into the AppContext

## Side Effects

- `mountManifestRoutes` mutates `ctx.app` by calling `app.use(mount, factory(ctx))` once per declared route
- `runManifestStartHooks` may write into the service registry via `ctx.register(...)` (modules' onStart hooks decide whether to do this)
- `runManifestShutdownHooks` swallows individual hook errors so a single misbehaving module cannot block the rest of shutdown

## Invariants

- A manifest declared with `enabled` returning `false` MUST contribute zero routes and zero lifecycle hooks for that startup
- Frontend bundles are NEVER gated by `enabled`: build artifacts always exist so the runtime can decide whether to serve the page that loads them
- Routes are mounted in `order` order (default 100), then by registry order — this is the only ordering guarantee modules may rely on
- `ctx.register(key, value)` MUST be idempotent within a single startup; the registry is private per-process state and never persisted
- Modules MUST NOT register routes on behalf of other modules — each manifest owns exactly its own contributions
- Restricted-zone modules (auth, sharing, permissions, per `CONSTITUTION.md`) MUST NOT appear in `registry.ts` without human maintainer sign-off

## Dependencies

- `express` — for the `Express` and `Router` types referenced by `AppContext` and `ApiRouteSpec`
- `pg` — for the `Pool` type re-exposed on `AppContext.pool`
- `@hocuspocus/server` — for the `Hocuspocus` type on `AppContext.hocuspocus`
- `auth`, `permissions`, `audit`, `workflow`, `observability`, `sharing`, `events`, `config`, `api/internal/redis` — type imports only; the contract module never invokes these modules, it just describes the shape of the context the composition root passes through

## Boundary Rules

- MUST: keep `AppContext` narrow — only fields that more than one feature module legitimately needs belong here; module-internal handles use `register`/`get` instead
- MUST: treat the registry as the single source of truth for which feature modules participate in composition
- MUST: sort routes by `order` (default 100) before calling `app.use`
- MUST: pass enabled-filtered manifests, not the raw list, to `mountManifestRoutes` and `runManifestStartHooks` — the helpers do not re-evaluate `enabled` themselves
- MUST: run `onShutdown` hooks in reverse start order
- MUST NOT: import any concrete module factory from this directory — manifests are imported only by `registry.ts`
- MUST NOT: introduce filesystem-glob auto-discovery; the registry must remain explicit so `grep` and contracts-first audits can trace control flow statically
- MUST NOT: persist anything in the service registry across process restarts — it is ephemeral per-startup state

## Verification

- **Enabled gating** → Unit test: a manifest with `enabled: () => false` mounts no routes and runs no lifecycle hooks
- **Order sorting** → Unit test: two routes on the same mount path with different `order` values are mounted in numeric order regardless of array position
- **Shutdown reversal** → Unit test: three manifests with onStart/onShutdown record call order; onShutdown sequence is reverse of onStart sequence
- **Service registry isolation** → Unit test: `register('x', 1)` followed by `get<number>('x')` returns 1; an unset key returns undefined
- **Bundle collection ignores enabled** → Unit test: a disabled manifest with declared bundles still contributes them to `collectManifestBundles`
- **Restricted-zone exclusion** → Code-review rule: any PR that adds `auth`, `sharing`, or `permissions` to `registry.ts` requires human maintainer approval per CONSTITUTION.md

## MVP Scope

Implemented:
- [x] `OpenDeskManifest`, `AppContext`, `ApiRouteSpec`, `FrontendBundleSpec`, `LifecycleSpec` types
- [x] `mountManifestRoutes` with `order`-aware sorting
- [x] `runManifestStartHooks` / `runManifestShutdownHooks` with reverse-order teardown
- [x] `collectManifestBundles` for build-time bundle aggregation
- [x] `createServiceRegistry` for module-internal handle stashing
- [x] Central `registry.ts` listing migrated modules

Post-MVP (deferred):
- [ ] Migrate restricted-zone modules (auth, sharing, permissions) once a human maintainer signs off
- [ ] Per-manifest health-check declarations the `/api/health` endpoint can aggregate
- [ ] Per-manifest schema migration declarations so `initSchema` becomes a registry walk

## How to add a new module

Adding a feature module to the composed application is exactly two steps. There is no need to edit `modules/api/internal/create-routes.ts`, `server.ts`, or `scripts/frontend-bundles.mjs` — those files do not know which feature modules exist.

### Step 1: Write `modules/<name>/manifest.ts`

```ts
/** Contract: contracts/<name>/rules.md */

import type { OpenDeskManifest } from '../core/manifest/contract.ts';
import { createFooRoutes } from './internal/foo-routes.ts';

export const manifest: OpenDeskManifest = {
  name: 'foo',
  contract: 'contracts/foo/rules.md',

  // Optional: gate the manifest behind a config flag
  // enabled: (config) => config.foo.enabled,

  apiRoutes: [
    {
      mount: '/api/foo',
      // Optional `order` (default 100). Lower numbers mount earlier;
      // use this to disambiguate when two manifests share a mount
      // path (e.g. /api/documents/search must mount before /:id).
      factory: (ctx) => createFooRoutes({ permissions: ctx.permissions }),
    },
  ],

  // Optional: declare frontend bundles the build script should produce
  // frontend: {
  //   bundles: [
  //     { kind: 'js',  entryPoint: 'modules/foo/internal/foo-page.ts', outfile: 'foo.bundle.js' },
  //     { kind: 'css', entryPoint: 'modules/foo/internal/foo.css',     outfile: 'foo.bundle.css' },
  //   ],
  // },

  // Optional: lifecycle hooks for modules with long-lived resources
  // (e.g. an event consumer that needs startConsumer/stopConsumer).
  // Use ctx.register/ctx.get to share the started handle with route
  // factories — see modules/ai/manifest.ts for the canonical example.
  // lifecycle: {
  //   onStart: (ctx) => { /* construct + start, return handle */ },
  //   onShutdown: (handle, ctx) => { /* graceful teardown */ },
  // },
};
```

### Step 2: Add the manifest to the registry

```ts
// modules/core/manifest/registry.ts
import { manifest as fooManifest } from '../../foo/manifest.ts';

export const manifests: OpenDeskManifest[] = [
  // …existing entries, alphabetized…
  fooManifest,
];
```

That is the entire workflow. The composition root iterates `manifests` and wires every entry's routes, bundles, and lifecycle hooks automatically.

### Where route factories should live

Route factories belong inside the owning module's `internal/` directory, not in `modules/api/internal/`. The api module is for api-layer infrastructure (auth middleware, CSP, idempotency, S3 upload helpers, the composition root) — not for domain routes. If you find yourself adding a `*-routes.ts` file under `modules/api/internal/`, ask whether the routes describe a feature that has a home in another module. They almost always do.

### Restricted-zone modules

Per `CONSTITUTION.md`, the auth, sharing, and permissions modules are restricted zones requiring human approval. Their routes are deliberately NOT in the manifest registry; they remain hand-mounted in `modules/api/internal/create-routes.ts` until a human maintainer signs off on migrating them.
