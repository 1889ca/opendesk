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
import { httpFetch, HttpFetchError } from '../../http/index.ts';

export interface CollaboraConfig {
  baseUrl: string;
  timeoutMs: number;
}

let _collaboraConfig: CollaboraConfig | null = null;

/** Inject CollaboraConfig from the composition root. Must be called before convertFile/convertToHtml. */
export function initCollabora(config: CollaboraConfig): void {
  _collaboraConfig = config;
}

function getDefaultConfig(): CollaboraConfig {
  if (!_collaboraConfig) {
    throw new Error('initCollabora() must be called before using convert functions — pass CollaboraConfig from the composition root');
  }
  return _collaboraConfig;
}

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
  config: CollaboraConfig = getDefaultConfig()
): Promise<Buffer> {
  const filter = getCollaboraFilter(targetFormat);
  const url = `${config.baseUrl}/cool/convert-to/${filter}`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)]);
  formData.append('data', blob, filename);

  try {
    const response = await httpFetch(url, {
      method: 'POST',
      body: formData,
      timeoutMs: config.timeoutMs,
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
    if (err instanceof HttpFetchError && err.code === 'TIMEOUT') {
      throw new CollaboraError(
        `Collabora conversion timed out after ${config.timeoutMs}ms`,
        undefined,
        err
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new CollaboraError(
      `Collabora conversion error: ${msg}`,
      undefined,
      err
    );
  }
}

/**
 * Convert an uploaded file to HTML via Collabora.
 * Used for import: file -> HTML -> ProseMirror JSON.
 */
export async function convertToHtml(
  fileBuffer: Buffer,
  filename: string,
  config: CollaboraConfig = getDefaultConfig()
): Promise<string> {
  const url = `${config.baseUrl}/cool/convert-to/html`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)]);
  formData.append('data', blob, filename);

  try {
    const response = await httpFetch(url, {
      method: 'POST',
      body: formData,
      timeoutMs: config.timeoutMs,
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
    if (err instanceof HttpFetchError && err.code === 'TIMEOUT') {
      throw new CollaboraError(
        `Collabora HTML conversion timed out after ${config.timeoutMs}ms`,
        undefined,
        err
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new CollaboraError(
      `Collabora HTML conversion error: ${msg}`,
      undefined,
      err
    );
  }
}
