/** Contract: contracts/observability/rules.md */
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { ObservabilityModule } from '../contract.ts';

export const CORRELATION_HEADER = 'x-correlation-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Express middleware that:
 * 1. Generates or propagates a correlation ID.
 * 2. Times the request and emits a metric on response finish.
 */
export function createTelemetryMiddleware(
  obs: ObservabilityModule,
  sampleRate: number,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = validUUID(req.headers[CORRELATION_HEADER] as string) ?? randomUUID();
    req.correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);

    // Skip non-API routes (static files, etc.)
    if (!req.path.startsWith('/api')) {
      next();
      return;
    }

    // Skip observability's own endpoint to avoid feedback loops
    if (req.path.startsWith('/api/admin/metrics')) {
      next();
      return;
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      // Sample rate check
      if (sampleRate < 1 && Math.random() > sampleRate) return;

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const operation = `${req.method} ${normalizePath(req.route?.path ?? req.path)}`;

      obs.recordMetric({
        correlationId,
        service: 'api',
        operation,
        durationMs,
        statusCode: res.statusCode,
        actorId: req.principal?.id,
        actorType: req.principal ? 'human' : undefined,
        tags: {},
      });
    });

    next();
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUUID(value: string | undefined): string | undefined {
  if (value && UUID_RE.test(value)) return value;
  return undefined;
}

/** Replace UUIDs and numeric IDs in paths with :id for aggregation. */
function normalizePath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}
