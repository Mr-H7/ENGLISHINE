import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { LocalStorageDriver } from './storage.local.js';
import { R2StorageDriver } from './storage.r2.js';
import type { StorageDriver, StoredObject, StoredUpload, UploadKind } from './storage.types.js';

export type { StoredUpload, UploadKind } from './storage.types.js';

export class StorageService {
  private readonly local = new LocalStorageDriver();
  private r2: R2StorageDriver | undefined;

  private driver(provider?: string): StorageDriver {
    const selected = provider === 'r2' || provider === 'local' ? provider : env.STORAGE_DRIVER;
    if (selected === 'r2') {
      this.r2 ??= new R2StorageDriver();
      return this.r2;
    }
    return this.local;
  }

  supportsDirectUpload(): boolean {
    return env.STORAGE_DRIVER === 'r2';
  }

  save(file: Parameters<StorageDriver['save']>[0], kind: UploadKind): Promise<StoredUpload> {
    return this.driver(env.STORAGE_DRIVER).save(file, kind);
  }

  presignPut(
    storageKey: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; headers: Record<string, string>; expiresIn: number }> {
    const selected = this.driver('r2');
    if (!(selected instanceof R2StorageDriver)) {
      throw new AppError(409, 'Direct upload requires R2 storage', 'DIRECT_UPLOAD_UNAVAILABLE');
    }
    return selected.presignPut(storageKey, mimeType);
  }

  headObject(
    storageKey: string,
  ): Promise<{ size: number; mimeType: string | null; checksum: string | null }> {
    const selected = this.driver('r2');
    if (!(selected instanceof R2StorageDriver)) {
      throw new AppError(409, 'Direct upload requires R2 storage', 'DIRECT_UPLOAD_UNAVAILABLE');
    }
    return selected.headObject(storageKey);
  }

  stat(storageKey: string, provider?: string): Promise<{ size: number }> {
    return this.driver(provider).stat(storageKey);
  }

  open(
    storageKey: string,
    options?: { range?: { start: number; end: number }; provider?: string },
  ): Promise<StoredObject> {
    const selected = this.driver(options?.provider);
    return options?.range ? selected.open(storageKey, options.range) : selected.open(storageKey);
  }

  remove(storageKey: string, provider?: string): Promise<void> {
    return this.driver(provider).remove(storageKey);
  }
}
