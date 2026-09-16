import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/app-error.js';

export function assertSafeStorageKey(storageKey: string): string {
  const key = storageKey.trim();
  if (
    !key ||
    key.startsWith('/') ||
    key.startsWith('\\') ||
    key.includes('..') ||
    key.includes('\\') ||
    key.includes('\0')
  ) {
    throw new AppError(400, 'Invalid storage key', 'INVALID_STORAGE_KEY');
  }
  return key;
}

export function objectFolder(kind: 'video' | 'material'): string {
  return `${kind}s/${new Date().toISOString().slice(0, 7)}`;
}

export function createObjectKey(kind: 'video' | 'material', extension: string): string {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (!/^\.[a-z0-9]{2,8}$/.test(ext)) {
    throw new AppError(400, 'Invalid storage key', 'INVALID_STORAGE_KEY');
  }
  return assertSafeStorageKey(`${objectFolder(kind)}/${randomUUID()}${ext}`);
}
