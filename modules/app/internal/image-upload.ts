/** Contract: contracts/app/rules.md */

import { apiFetch } from './api-client.ts';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export interface UploadResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
}

/** Validate a file before uploading. Returns an error string or null. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'image.unsupportedType';
  if (file.size > MAX_SIZE) return 'image.tooLarge';
  return null;
}

/** Upload an image file to the server, returns the served URL. */
export async function uploadImage(
  file: File,
  documentId: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentId', documentId);

  const res = await apiFetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  return res.json() as Promise<UploadResult>;
}

/** Extract image files from a paste or drop DataTransfer. */
export function extractImageFiles(data: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < data.files.length; i++) {
    const f = data.files[i];
    if (ALLOWED_TYPES.has(f.type)) files.push(f);
  }
  return files;
}
