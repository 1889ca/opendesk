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
