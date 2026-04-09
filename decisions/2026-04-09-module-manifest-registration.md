# Decision: Module Manifest Registration replaces hand-mounted route god function

**Date:** 2026-04-09
**Status:** Accepted (implemented)
**Driven by:** Maintainer observation that adding new routes/CSS required editing central files (`create-routes.ts`, `frontend-bundles.mjs`) — registration was manual and hacky, violating the "lego blocks" principle.

## Context

`modules/api/internal/create-routes.ts` had grown into a 215-line god function that hand-imported every module's route factory and manually called `app.use(...)` for each. Adding a new feature module required:

1. Importing its `createXxxRoutes` factory at the top of `create-routes.ts`
2. Threading new dependencies through a `RouteDependencies` interface
3. Hand-mounting the route in the right order
4. (For frontend) editing `scripts/frontend-bundles.mjs` to add bundle entries

The composition root knew the names of every feature module by name. This is backwards: modules should declare what they expose; the composition root should just enumerate.

The pain compounded over time:
- A 215-line file no agent could safely refactor
- Order-sensitive `app.use(...)` calls with implicit dependencies (search must mount before `/:id`)
- Conditional gating (`if (config.ai.enabled)`) hard-wired into the composition root
- The AI module's lifecycle (`startConsumer` / `stopConsumer`) split across `server.ts` and `create-routes.ts`
- Audit/workflow/etc. reaching back into `pool` from `storage/internal/` because there was no clean DI surface
- Four route files (starred, global-search, presentation-convert, sheet-convert) had been shipped but **never wired in** — frontend code was silently 404ing in production. Discovering this required a full audit of `api/internal/`.

## Decision

Introduce a **typed module manifest system** at `modules/core/manifest/`:

- `OpenDeskManifest` type — each module declares its API routes, frontend bundles, lifecycle hooks, and an optional `enabled` gate
- `AppContext` — single typed dependency-injection surface passed to every manifest factory and lifecycle hook
- Central registry at `modules/core/manifest/registry.ts` — one import + one array entry per module
- Helper functions (`mountManifestRoutes`, `runManifestStartHooks`, `runManifestShutdownHooks`, `collectManifestBundles`, `createServiceRegistry`, `filterEnabled`)
- A service registry on the AppContext (`register` / `get`) so modules with lifecycle hooks can stash a handle that their own route factories read later (the AI consumer pattern)

### What we did NOT do

- **Filesystem auto-discovery** — tempting but breaks `grep`-based code reading and creates import-order surprises. The contracts-first / agent-first methodology values explicit static traceability over magic.
- **Plugin DI containers (inversify, tsyringe)** — overkill, hides wiring agents are supposed to read.
- **Big-bang refactor** — landed as 18 incremental commits, each independently shippable.
- **Migrate restricted zones** — auth, sharing, permissions stay hand-mounted in `create-routes.ts` per CONSTITUTION.md until a human maintainer signs off.

## Consequences

### Positive

- **`create-routes.ts` shrank from 215 → 147 lines** and now contains zero feature-module names. The only domain reference left is the share-routes hand-mount (restricted zone, deliberate).
- **Adding a new module is two lines.** Write `manifest.ts`, add one import + one array entry. No edits to the composition root, no edits to the build script.
- **13 modules migrated:** ai, api, audit, convert, document, erasure, federation, kb, notifications, observability, references, storage, workflow.
- **4 silently-broken features fixed.** The audit surfaced `starred`, `global-search`, `presentation-convert`, `sheet-convert` route files that had been shipped but never mounted. The manifest pattern made wiring them trivial — each got 5-10 lines in their owning module's manifest.
- **Route factories now live in their owning modules.** `modules/api/internal/` no longer hosts domain routes — every `*-routes.ts` file under it is api-layer infrastructure (admin/upload/file). Domain routes moved to `modules/{document,kb,references,convert,storage,notifications,observability}/internal/`.
- **Lifecycle hooks unify startup/shutdown.** The AI module's `startConsumer`/`stopConsumer` dance is no longer split across `server.ts` and `create-routes.ts` — it's one onStart/onShutdown pair in `modules/ai/manifest.ts`.
- **Build script is derived, not authoritative.** `scripts/frontend-bundles.mjs` now reads the manifest registry via `tsx/esm/api`, so the #137-style bug (hand-maintained list developing typos) is structurally impossible for migrated modules.
- **14 unit tests** in `modules/core/manifest/` cover every contract verification point (enabled gating, order sorting, shutdown reversal, registry isolation, bundle-collection-ignores-enabled).

### Negative / trade-offs

- **`AppContext` is a wide type.** It surfaces 13+ fields because the migrated modules collectively need them. This is the explicit cost of static DI: every module sees every dependency, even ones it doesn't use. Acceptable because grep-ability matters more than minimal coupling here.
- **`tsx/esm/api` runtime dependency for the build script.** Adds a tsx import to `scripts/frontend-bundles.mjs` so it can read the typed registry. tsx was already a dep; no package.json change needed.
- **Restricted-zone modules remain manual.** auth/sharing/permissions can't be migrated without human review. The composition root still has a small hand-mounted block for them.
- **Two routes share a mount path require explicit `order` values.** This is more verbose than implicit source-order in `app.use` calls, but the constraint is now declarative and visible.

### Deferred (post-MVP)

- Migrate restricted-zone modules (auth, sharing, permissions) once a human maintainer signs off
- Per-manifest health-check declarations the `/api/health` endpoint can aggregate
- Per-manifest schema migration declarations so `initSchema` becomes a registry walk
- Cleanup zombie WIP files in `modules/api/internal/` (none remaining after this PR)

## References

- Contract: `contracts/core/manifest/rules.md`
- Implementation: `modules/core/manifest/{contract.ts, mount.ts, registry.ts, index.ts}`
- Tests: `modules/core/manifest/mount.{routes,lifecycle}.test.ts`
- Updated api contract: `contracts/api/rules.md` (now points to per-module manifests for domain routes)
- Sample manifests at every complexity level:
  - **pure factory:** `modules/audit/manifest.ts`, `modules/notifications/manifest.ts`
  - **inline factory + dependency:** `modules/erasure/manifest.ts`
  - **gated by config:** `modules/federation/manifest.ts`
  - **multiple routes + frontend bundles:** `modules/workflow/manifest.ts`
  - **6 routes with order sorting:** `modules/kb/manifest.ts`
  - **full lifecycle (onStart/onShutdown/registry):** `modules/ai/manifest.ts`
