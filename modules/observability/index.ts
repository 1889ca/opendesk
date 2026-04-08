/** Contract: contracts/observability/rules.md */

// Schemas & types
export {
  ContentTypeSchema,
  MetricNameSchema,
  MetricSampleSchema,
  TimeSeriesBucketSchema,
  SeveritySchema,
  AnomalyAlertSchema,
  ForensicsQuerySchema,
  ForensicsEventSchema,
  SiemFormatSchema,
  SiemConfigSchema,
  type ContentType,
  type MetricName,
  type MetricSample,
  type TimeSeriesBucket,
  type Severity,
  type AnomalyAlert,
  type ForensicsQuery,
  type ForensicsEvent,
  type SiemFormat,
  type SiemConfig,
  type ObservabilityModule,
} from './contract.ts';

// Factory
export {
  createObservability,
  type ObservabilityDependencies,
} from './internal/create-observability.ts';

// Routes
export {
  createObservabilityRoutes,
  type ObservabilityRoutesOptions,
} from './internal/observability-routes.ts';

export {
  createSiemRoutes,
  type SiemRoutesOptions,
} from './internal/siem-routes.ts';

// SIEM formatter (for external use)
export { formatEvents } from './internal/siem-formatter.ts';

// Forensics store (for event ingestion)
export { insertForensicsEvent } from './internal/forensics-store.ts';
