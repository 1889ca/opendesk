/** Contract: contracts/ediscovery/rules.md */

// Types & schemas
export {
  SarRequestSchema,
  FoiaRequestSchema,
  ExportFormatSchema,
  SarExportResultSchema,
  FoiaExportResultSchema,
  DocumentSummarySchema,
  VersionSummarySchema,
  type SarRequest,
  type FoiaRequest,
  type ExportFormat,
  type ExportBundle,
  type SarExportResult,
  type FoiaExportResult,
  type DocumentSummary,
  type VersionSummary,
  type EDiscoveryModule,
} from './contract.ts';

// Factory
export { createEDiscovery, type EDiscoveryDependencies } from './internal/create-ediscovery.ts';

// Routes
export { createEDiscoveryRoutes, type EDiscoveryRoutesOptions } from './internal/ediscovery-routes.ts';

// Engines (for direct use)
export { executeSarExport } from './internal/sar-engine.ts';
export { executeFoiaExport } from './internal/foia-engine.ts';

// Formatter
export { formatExport } from './internal/export-formatter.ts';
