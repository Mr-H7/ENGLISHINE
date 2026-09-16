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
