/** Contract: contracts/convert/rules.md */

/**
 * Collabora Online REST API client.
 *
 * Uses the /cool/convert-to endpoint:
 *   POST /cool/convert-to/<format>
 *   Body: multipart/form-data with file in "data" field
 *   Returns: converted file bytes
 */

import type { ExportFormat } from '../contract.ts';
import { getCollaboraFilter } from './formats.ts';

export interface CollaboraConfig {
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_CONFIG: CollaboraConfig = {
  baseUrl: process.env.COLLABORA_URL || 'http://localhost:9980',
  timeoutMs: parseInt(process.env.COLLABORA_TIMEOUT_MS || '30000', 10),
};

export class CollaboraError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CollaboraError';
  }
}

/**
 * Convert a file buffer to the target format via Collabora's REST API.
 * POST /cool/convert-to/<format> with multipart form data.
 */
export async function convertFile(
  fileBuffer: Buffer,
  filename: string,
  targetFormat: ExportFormat,
  config: CollaboraConfig = DEFAULT_CONFIG
): Promise<Buffer> {
  const filter = getCollaboraFilter(targetFormat);
  const url = `${config.baseUrl}/cool/convert-to/${filter}`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)]);
  formData.append('data', blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CollaboraError(
        `Collabora conversion failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: unknown) {
    if (err instanceof CollaboraError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort')) {
      throw new CollaboraError(
        `Collabora conversion timed out after ${config.timeoutMs}ms`,
        undefined,
        err
      );
    }
    throw new CollaboraError(
      `Collabora conversion error: ${msg}`,
      undefined,
      err
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert an uploaded file to HTML via Collabora.
 * Used for import: file -> HTML -> ProseMirror JSON.
 */
export async function convertToHtml(
  fileBuffer: Buffer,
  filename: string,
  config: CollaboraConfig = DEFAULT_CONFIG
): Promise<string> {
  const url = `${config.baseUrl}/cool/convert-to/html`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)]);
  formData.append('data', blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CollaboraError(
        `Collabora HTML conversion failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    return await response.text();
  } catch (err: unknown) {
    if (err instanceof CollaboraError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new CollaboraError(
      `Collabora HTML conversion error: ${msg}`,
      undefined,
      err
    );
  } finally {
    clearTimeout(timer);
  }
}
