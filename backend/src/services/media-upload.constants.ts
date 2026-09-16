import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import type { UploadKind } from './storage.types.js';

export const DIRECT_UPLOAD_TTL_SECONDS = 300;

export const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
export const allowedMaterialTypes = new Set(['application/pdf']);

const mimeExtensions: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
};

export function allowedMimeTypes(kind: UploadKind): Set<string> {
  return kind === 'video' ? allowedVideoTypes : allowedMaterialTypes;
}

export function maxBytesForKind(kind: UploadKind): number {
  return kind === 'video' ? env.UPLOAD_MAX_FILE_BYTES : env.MATERIAL_MAX_FILE_BYTES;
}

export function extensionForMime(mimeType: string): string {
  const extension = mimeExtensions[mimeType];
  if (!extension) {
    throw new AppError(415, 'Unsupported file type', 'UNSUPPORTED_FILE_TYPE');
  }
  return extension;
}

export function assertAllowedUpload(kind: UploadKind, mimeType: string, byteSize: number): void {
  if (!allowedMimeTypes(kind).has(mimeType)) {
    throw new AppError(415, `Unsupported ${kind} file type`, 'UNSUPPORTED_FILE_TYPE');
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new AppError(400, 'A positive file size is required', 'INVALID_FILE_SIZE');
  }
  if (byteSize > maxBytesForKind(kind)) {
    throw new AppError(413, 'Uploaded file is too large', 'UPLOAD_TOO_LARGE');
  }
}
