/** Contract: contracts/kb/rules.md */
export {
  // Schemas
  EntitySubtypeSchema,
  KBEntitySchema,
  KBEntitySummarySchema,
  EntityCreateInputSchema,
  EntityUpdateInputSchema,
  PersonContentSchema,
  OrganizationContentSchema,
  ProjectContentSchema,
  TermContentSchema,

  // Types
  type EntitySubtype,
  type KBEntity,
  type KBEntitySummary,
  type EntityCreateInput,
  type EntityUpdateInput,
  type PersonContent,
  type OrganizationContent,
  type ProjectContent,
  type TermContent,

  // Constants
  ENTITY_SUBTYPES,

  // Helpers
  contentSchemaForSubtype,
} from './contract.ts';

// Entity CRUD
export {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity,
  searchEntities,
} from './internal/pg-entities.ts';

// Content validation
export {
  validateContent,
  validateContentSafe,
} from './internal/validate-content.ts';

// Row types
export type { EntityRow, EntityUpdates } from './internal/pg-entities.ts';
