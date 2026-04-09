/** Contract: contracts/observability/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import {
  MetricSampleSchema,
  ForensicsQuerySchema,
  SiemFormatSchema,
  MetricNameSchema,
  type ObservabilityModule,
} from '../contract.ts';
import { asyncHandler } from '../../api/index.ts';

export type ObservabilityRoutesOptions = {
  permissions: PermissionsModule;
  observability: ObservabilityModule;
};

/** Mount observability API routes. */
export function createObservabilityRoutes(opts: ObservabilityRoutesOptions): Router {
  const router = Router();
  const { permissions, observability } = opts;

  // POST /metrics — record a metric sample
  router.post(
    '/metrics',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = MetricSampleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      await observability.record(parsed.data);
      res.status(201).json({ ok: true });
    }),
  );

  // GET /metrics/timeseries — query time-series buckets
  router.get(
    '/metrics/timeseries',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const query = TimeSeriesQuerySchema.safeParse(req.query);
      if (!query.success) {
        res.status(400).json({ error: 'Validation failed', issues: query.error.issues });
        return;
      }
      const { metric, from, to, bucketSeconds } = query.data;
      const buckets = await observability.queryTimeSeries(metric, from, to, bucketSeconds);
      res.json(buckets);
    }),
  );

  // POST /anomalies/detect — trigger anomaly detection
  router.post(
    '/anomalies/detect',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const alerts = await observability.detectAnomalies();
      res.json(alerts);
    }),
  );

  // POST /anomalies/:id/acknowledge — acknowledge an alert
  router.post(
    '/anomalies/:id/acknowledge',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const userId = (req as any).principal?.id ?? 'unknown';
      await observability.acknowledgeAlert(id, userId);
      res.json({ ok: true });
    }),
  );

  // GET /forensics — query forensics events
  router.get(
    '/forensics',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = ForensicsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const events = await observability.queryForensics(parsed.data);
      res.json(events);
    }),
  );

  // GET /siem/export — export events in SIEM format
  router.get(
    '/siem/export',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SiemExportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }
      const { format, from, to } = parsed.data;
      const data = await observability.exportSiem(format, from, to);

      const contentTypeMap = {
        cef: 'text/plain',
        syslog: 'text/plain',
        jsonlines: 'application/x-ndjson',
      } as const;

      res.setHeader('Content-Type', contentTypeMap[format]);
      res.setHeader('Content-Disposition', `attachment; filename="siem-export.${format === 'jsonlines' ? 'ndjson' : 'txt'}"`);
      res.send(data);
    }),
  );

  return router;
}

// --- Query Schemas ---

const TimeSeriesQuerySchema = z.object({
  metric: MetricNameSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
  bucketSeconds: z.coerce.number().int().positive().optional().default(300),
});

const SiemExportQuerySchema = z.object({
  format: SiemFormatSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
});
