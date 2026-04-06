/** Contract: contracts/permissions/rules.md */
export {
  // Schemas
  RoleSchema,
  ActionSchema,
  GrantSchema,
  GrantDefSchema,
  PermissionQuerySchema,
  PermissionResultSchema,

  // Types
  type Role,
  type Action,
  type Grant,
  type GrantDef,
  type PermissionQuery,
  type PermissionResult,

  // Constants
  ROLES,
  ACTIONS,
  ROLE_RANK,
  ACTION_MIN_ROLE,

  // Evaluation
  evaluate,
} from './contract.ts';

// Grant storage
export {
  type GrantStore,
  createInMemoryGrantStore,
} from './internal/grant-store.ts';

// Middleware
export { requirePermission, requireAuth } from './internal/middleware.ts';

// Factory
export {
  createPermissions,
  type PermissionsModule,
  type PermissionsDependencies,
} from './internal/create-permissions.ts';
