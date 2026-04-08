/** Contract: contracts/convert/rules.md */

/**
 * Export pipeline: flush -> wait -> read snapshot -> render HTML -> Collabora convert.
 *
 * Per contract invariants:
 * - Always emits ConversionRequested before reading snapshot
 * - Waits for StateFlushed with timeout (default 10s)
 * - Sets stale flag honestly
 * - Always emits ExportReady when done
 */

import { randomUUID } from 'node:crypto';
import type { ExportFormat, ConversionResult } from '../contract.ts';
import { EventType, type DomainEvent, type EventBus } from '../../events/contract.ts';
import { convertFile } from './libreoffice.ts';
import { getDocument } from '../../storage/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('convert');

/** Default flush timeout — used when no explicit value is provided. */
const DEFAULT_FLUSH_TIMEOUT_MS = 10000;

export class ExportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ExportError';
  }
}

export interface ExportResult {
  documentId: string;
  format: ExportFormat;
  stale: boolean;
  fileBuffer: Buffer;
  exportedAt: string;
}

/**
 * Full export pipeline with flush coordination.
 *
 * When no EventBus is available (MVP), falls back to reading
 * the current snapshot directly (stale=true).
 */
export async function exportDocument(
  documentId: string,
  format: ExportFormat,
  requestedBy: string,
  html: string,
  eventBus?: EventBus,
  opts?: { flushTimeoutMs?: number }
): Promise<ExportResult> {
  let stale = true;

  const flushTimeoutMs = opts?.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
  if (eventBus) {
    stale = await flushAndWait(documentId, format, requestedBy, eventBus, flushTimeoutMs);
  }

  const doc = await getDocument(documentId);
  const title = doc?.title || 'document';
  const filename = `${title}.html`;

  const htmlBuffer = Buffer.from(html, 'utf-8');
  const fileBuffer = await convertFile(htmlBuffer, filename, format);

  const exportedAt = new Date().toISOString();

  const result: ExportResult = {
    documentId,
    format,
    stale,
    fileBuffer,
    exportedAt,
  };

  if (eventBus) {
    await emitExportReady(eventBus, result);
  }

  return result;
}

/** Emit ConversionRequested and wait for StateFlushed */
async function flushAndWait(
  documentId: string,
  _format: ExportFormat,
  requestedBy: string,
  eventBus: EventBus,
  flushTimeoutMs: number
): Promise<boolean> {
  const conversionEvent: DomainEvent = {
    id: randomUUID(),
    type: EventType.ConversionRequested,
    aggregateId: documentId,
    actorId: requestedBy,
    actorType: 'system',
    occurredAt: new Date().toISOString(),
  };
  await eventBus.emit(conversionEvent, null);

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(true), flushTimeoutMs);

    const group = `convert-flush-${documentId}-${Date.now()}`;
    eventBus.subscribe(group, [EventType.StateFlushed], async () => {
      clearTimeout(timeout);
      resolve(false);
    }).catch(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

/** Emit ExportReady event */
async function emitExportReady(
  eventBus: EventBus,
  result: ExportResult
): Promise<void> {
  const event: DomainEvent = {
    id: randomUUID(),
    type: EventType.ExportReady,
    aggregateId: result.documentId,
    actorId: 'convert',
    actorType: 'system',
    occurredAt: result.exportedAt,
  };
  await eventBus.emit(event, null).catch(() => {
    log.error('failed to emit ExportReady event');
  });
}

/**
 * Build a ConversionResult metadata object (without file bytes).
 */
export function toConversionResult(result: ExportResult): ConversionResult {
  return {
    documentId: result.documentId,
    format: result.format,
    stale: result.stale,
    exportedAt: result.exportedAt,
  };
}
