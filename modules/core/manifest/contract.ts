/** Contract: contracts/core/manifest/rules.md */

import type { Express, Router } from 'express';
import type { Pool } from 'pg';
import type { Hocuspocus } from '@hocuspocus/server';
import type { AuthModule } from '../../auth/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { CacheClient } from '../../api/internal/redis.ts';
import type { AuditModule } from '../../audit/contract.ts';
import type { WorkflowModule } from '../../workflow/contract.ts';
import type { ObservabilityModule } from '../../observability/contract.ts';
import type { ShareLinkService } from '../../sharing/internal/share-links.ts';
import type {
  PasswordRateLimiter,
  ShareResolveRateLimiter,
} from '../../sharing/internal/rate-limit.ts';
import type { AppConfig } from '../../config/contract.ts';
import type { EventBusModule } from '../../events/contract.ts';

/**
 * Composition-root context passed to every manifest's factories and
 * lifecycle hooks. Modules read whatever they need from this object;
 * the context is the single, typed dependency-injection surface that
 * replaces the ad-hoc `RouteDependencies` interface that used to live
 * in modules/api/internal/create-routes.ts.
 *
 * Keep this surface narrow: only put things here that more than one
 * module legitimately needs. Module-internal handles created by
 * lifecycle hooks (e.g. an AI consumer instance) should be stashed
 * via {@link AppContext.register} and read with
 * {@link AppContext.get}, not added as top-level fields.
 */
export interface AppContext {
  app: Express;
  config: AppConfig;
  pool: Pool;

  auth: AuthModule;
  permissions: PermissionsModule;
  hocuspocus: Hocuspocus;
  redisClient: CacheClient;
  eventBus: EventBusModule;
  audit: AuditModule;
  workflow: WorkflowModule;
  observability: ObservabilityModule;
  shareLinkService: ShareLinkService;
  shareRateLimiter: PasswordRateLimiter;
  shareResolveRateLimiter: ShareResolveRateLimiter;
  publicDir: string;

  /**
   * Stash a handle produced by a manifest lifecycle hook so that the
   * same manifest's route factories (which run later) can read it.
   * Returns the value for chaining.
   */
  register<T>(key: string, value: T): T;
  /** Read a previously {@link register}ed handle. */
  get<T>(key: string): T | undefined;
}

/** A single API route mount declaration. */
export interface ApiRouteSpec {
  /** Express path prefix where the router is mounted (e.g. `/api/audit`). */
  mount: string;

  /**
   * Lower numbers mount earlier. Use to disambiguate when two
   * manifests share a mount path (e.g. `/api/documents/search` must
   * be mounted before `/api/documents/:id` so the literal route is
   * matched first). Default: 100.
   */
  order?: number;

  /** Factory that builds the Router given the composition-root context. */
  factory: (ctx: AppContext) => Router;
}

export type FrontendBundleKind = 'js' | 'css';

/**
 * Frontend bundle declaration. Paths are repo-root-relative so the
 * build script can hand them straight to esbuild without further
 * resolution.
 */
export interface FrontendBundleSpec {
  kind: FrontendBundleKind;
  /** Repo-root-relative entry point (e.g. `modules/workflow/internal/...`). */
  entryPoint: string;
  /** Output filename, written into `modules/app/internal/public/`. */
  outfile: string;
  /** esbuild alias map (JS only). */
  alias?: Record<string, string>;
}

export interface FrontendSpec {
  bundles?: FrontendBundleSpec[];
}

export interface LifecycleSpec {
  /**
   * Runs after every manifest's API routes are mounted but BEFORE
   * the HTTP server starts listening. Return a handle that will be
   * passed to {@link LifecycleSpec.onShutdown} verbatim.
   *
   * Use {@link AppContext.register} inside onStart if the same
   * module's route factories need access to the started handle.
   */
  onStart?: (ctx: AppContext) => Promise<unknown> | unknown;
  /**
   * Runs during graceful shutdown. Receives the handle returned by
   * {@link LifecycleSpec.onStart} (or `undefined` if onStart was
   * not declared).
   */
  onShutdown?: (handle: unknown, ctx: AppContext) => Promise<void> | void;
}

/**
 * One module's contribution to the composed OpenDesk application.
 *
 * The composition root walks an array of these and wires API routes,
 * frontend bundles, and lifecycle hooks. Each manifest is owned by
 * exactly one module — modules MUST NOT register things on behalf of
 * other modules. Adding a new feature module is exactly two lines:
 * write `modules/<name>/manifest.ts`, then add one import + one
 * array entry in `modules/core/manifest/registry.ts`.
 */
export interface OpenDeskManifest {
  /** Module name; matches the directory under `modules/`. */
  name: string;
  /** Path to the contract file (e.g. `contracts/audit/rules.md`). */
  contract?: string;

  /**
   * Optional runtime gate. If present and returns `false` at startup,
   * the manifest is skipped entirely: no routes mounted, no
   * lifecycle hooks fired. Frontend bundles are NOT gated — they are
   * collected unconditionally so build artifacts always exist; the
   * runtime decides whether the page that loads them is reachable.
   */
  enabled?: (config: AppConfig) => boolean;

  apiRoutes?: ApiRouteSpec[];
  frontend?: FrontendSpec;
  lifecycle?: LifecycleSpec;
}
