import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertSafeStorageKey } from './storage.keys.js';
import type { UploadKind } from './storage.types.js';
import { DIRECT_UPLOAD_TTL_SECONDS } from './media-upload.constants.js';

export interface DirectUploadAuthorization {
  purpose: 'r2-direct-upload';
  jti: string;
  sub: string;
  lessonId: string;
  kind: UploadKind;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  originalName: string;
  title: string;
  type: string;
  position: number;
  status?: string;
  accessLevel?: string;
  durationSeconds?: number;
  isDownload?: boolean;
  exp: number;
}

function encode(payload: DirectUploadAuthorization): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signBody(body: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url');
}

export function issueDirectUploadAuthorization(
  input: Omit<DirectUploadAuthorization, 'purpose' | 'jti' | 'exp'>,
): { token: string; expiresIn: number; expiresAt: string } {
  const expiresIn = DIRECT_UPLOAD_TTL_SECONDS;
  const payload: DirectUploadAuthorization = {
    purpose: 'r2-direct-upload',
    jti: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    ...input,
    storageKey: assertSafeStorageKey(input.storageKey),
  };
  const body = encode(payload);
  return {
    token: `${body}.${signBody(body)}`,
    expiresIn,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyDirectUploadAuthorization(
  token: string,
  userId: string,
): DirectUploadAuthorization {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    throw new AppError(400, 'Invalid upload authorization', 'INVALID_UPLOAD_AUTHORIZATION');
  }
  const expected = signBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError(400, 'Invalid upload authorization', 'INVALID_UPLOAD_AUTHORIZATION');
  }
  let payload: DirectUploadAuthorization;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DirectUploadAuthorization;
  } catch {
    throw new AppError(400, 'Invalid upload authorization', 'INVALID_UPLOAD_AUTHORIZATION');
  }
  if (payload.purpose !== 'r2-direct-upload' || payload.sub !== userId) {
    throw new AppError(403, 'Upload authorization does not match this session', 'UPLOAD_AUTHORIZATION_MISMATCH');
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new AppError(401, 'Upload authorization has expired', 'UPLOAD_AUTHORIZATION_EXPIRED');
  }
  payload.storageKey = assertSafeStorageKey(payload.storageKey);
  return payload;
}
