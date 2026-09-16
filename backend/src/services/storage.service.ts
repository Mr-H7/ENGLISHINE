import { env } from '../config/env.js';
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

  save(file: Parameters<StorageDriver['save']>[0], kind: UploadKind): Promise<StoredUpload> {
    return this.driver(env.STORAGE_DRIVER).save(file, kind);
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
