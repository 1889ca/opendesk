/** Contract: contracts/observability/rules.md */

// Schemas & types
export {
  MetricEntrySchema,
  HealthIndicatorSchema,
  MetricsSummarySchema,
  TimeSeriesPointSchema,
  ObservabilityConfigSchema,
  ContentTypeSchema,
  MetricNameSchema,
  SeveritySchema,
  SiemFormatSchema,
  MetricSampleSchema,
  AnomalyAlertSchema,
  ForensicsQuerySchema,
  ForensicsEventSchema,
  SiemConfigSchema,
  type MetricEntry,
  type HealthIndicator,
  type MetricsSummary,
  type TimeSeriesPoint,
  type MetricsFilter,
  type ObservabilityConfig,
  type ObservabilityModule,
  type ContentType,
  type MetricName,
  type Severity,
  type SiemFormat,
  type MetricSample,
  type AnomalyAlert,
  type ForensicsQuery,
  type ForensicsEvent,
  type SiemConfig,
} from './contract.ts';

// Factory
export { createObservability, type ObservabilityDependencies } from './internal/create-observability.ts';

// Middleware
export { createTelemetryMiddleware, CORRELATION_HEADER } from './internal/http-middleware.ts';

// Routes
export { createMetricsRoutes, type MetricsRoutesOptions } from './internal/metrics-routes.ts';
