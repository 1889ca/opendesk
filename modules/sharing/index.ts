/** Contract: contracts/sharing/rules.md */

// Schemas (Zod)
export {
  GrantRoleSchema,
  GrantStatusSchema,
  GrantSchema,
  ShareLinkOptionsSchema,
  ShareLinkSchema,
  InviteRequestSchema,
  GrantCreatedEventSchema,
  GrantRevokedEventSchema,
} from './contract.ts';

// Types
export type {
  GrantRole,
  GrantStatus,
  Grant,
  ShareLinkOptions,
  ShareLink,
  InviteRequest,
  GrantCreatedEvent,
  GrantRevokedEvent,
} from './contract.ts';

// Share link service
export {
  createShareLinkService,
  hashPassword,
  generateToken,
  type ShareLinkService,
  type ShareLinkResult,
  type CreateShareLinkInput,
} from './internal/share-links.ts';

// Store
export {
  createInMemoryShareLinkStore,
  type ShareLinkStore,
} from './internal/store.ts';

export { createPgShareLinkStore } from './internal/pg-store.ts';

// Rate limiting
export {
  createPasswordRateLimiter,
  createInMemoryPasswordRateLimiter,
  type PasswordRateLimiter,
  type RateLimiterOptions,
} from './internal/rate-limit.ts';

// Routes
export { createShareRoutes, type ShareRoutesOptions } from './internal/routes.ts';
