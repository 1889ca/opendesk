/** Contract: contracts/core/manifest/rules.md */

import type { AppContext, FrontendBundleSpec, OpenDeskManifest } from './contract.ts';

/** Pair of manifest + handle returned by an onStart hook. */
export interface ManifestStartHandle {
  manifest: OpenDeskManifest;
  handle: unknown;
}

/**
 * Filter the manifest list down to those whose `enabled` gate (if
 * any) returns true. Pure function — exposed so the composition
 * root can compute the active set once and pass it to both
 * {@link mountManifestRoutes} and {@link runManifestStartHooks}.
 */
export function filterEnabled(
  manifests: OpenDeskManifest[],
  ctx: Pick<AppContext, 'config'>,
): OpenDeskManifest[] {
  return manifests.filter((m) => !m.enabled || m.enabled(ctx.config));
}

/**
 * Mount API routes from the supplied manifests onto `ctx.app`.
 * Routes are sorted by their `order` field (default 100) so that
 * order-sensitive mounts can be expressed declaratively instead of
 * relying on the source-order of `app.use(...)` calls.
 *
 * The caller is responsible for passing only the *enabled* manifests
 * (use {@link filterEnabled}); this function does not re-evaluate
 * the gate.
 */
export function mountManifestRoutes(
  ctx: AppContext,
  manifests: OpenDeskManifest[],
): void {
  const routes = manifests.flatMap((m) =>
    (m.apiRoutes ?? []).map((route) => ({ manifest: m, route })),
  );

  routes.sort((a, b) => (a.route.order ?? 100) - (b.route.order ?? 100));

  for (const { route } of routes) {
    ctx.app.use(route.mount, route.factory(ctx));
  }
}

/**
 * Run `onStart` for every supplied manifest in declaration order and
 * return the resulting handles, ready to be passed to
 * {@link runManifestShutdownHooks} during graceful shutdown.
 */
export async function runManifestStartHooks(
  ctx: AppContext,
  manifests: OpenDeskManifest[],
): Promise<ManifestStartHandle[]> {
  const handles: ManifestStartHandle[] = [];
  for (const manifest of manifests) {
    if (manifest.lifecycle?.onStart) {
      const handle = await manifest.lifecycle.onStart(ctx);
      handles.push({ manifest, handle });
    }
  }
  return handles;
}

/**
 * Run `onShutdown` for every started manifest, in reverse start
 * order. Errors thrown by individual hooks are swallowed so a single
 * misbehaving module cannot block the rest of shutdown.
 */
export async function runManifestShutdownHooks(
  ctx: AppContext,
  handles: ManifestStartHandle[],
): Promise<void> {
  for (const { manifest, handle } of [...handles].reverse()) {
    if (!manifest.lifecycle?.onShutdown) continue;
    try {
      await manifest.lifecycle.onShutdown(handle, ctx);
    } catch {
      // Best-effort shutdown — never let one module's teardown
      // prevent the rest from running.
    }
  }
}

/**
 * Flatten every manifest's frontend bundle declarations into a single
 * list, in registry order. Bundles are NOT gated by `enabled` — see
 * the OpenDeskManifest doc comment for the rationale.
 *
 * Used by `scripts/frontend-bundles.mjs` to derive the build/watch
 * input list. Returning a plain object array (rather than a class)
 * keeps the build script free of TS-only constructs.
 */
export function collectManifestBundles(
  manifests: OpenDeskManifest[],
): FrontendBundleSpec[] {
  return manifests.flatMap((m) => m.frontend?.bundles ?? []);
}

/**
 * Build a no-op service registry suitable for the
 * {@link AppContext.register}/{@link AppContext.get} surface. The
 * composition root creates one of these and folds it into the
 * AppContext literal.
 */
export function createServiceRegistry(): Pick<AppContext, 'register' | 'get'> {
  const services = new Map<string, unknown>();
  return {
    register<T>(key: string, value: T): T {
      services.set(key, value);
      return value;
    },
    get<T>(key: string): T | undefined {
      return services.get(key) as T | undefined;
    },
  };
}
