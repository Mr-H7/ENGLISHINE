import type { Readable } from 'node:stream';
import type { MultipartFile } from '@fastify/multipart';

export type UploadKind = 'video' | 'material';

export interface StoredUpload {
  storageKey: string;
  originalName: string;
  mimeType: string;
  byteSize: bigint;
  checksum: string;
  storageProvider?: string;
}

export interface StoredObject {
  details: { size: number };
  stream: Readable;
}

export interface StorageDriver {
  save(file: MultipartFile, kind: UploadKind): Promise<StoredUpload>;
  stat(storageKey: string): Promise<{ size: number }>;
  open(storageKey: string, range?: { start: number; end: number }): Promise<StoredObject>;
  remove(storageKey: string): Promise<void>;
}
