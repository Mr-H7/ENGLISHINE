import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { fileTypeFromFile } from 'file-type';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertSafeStorageKey, objectFolder } from './storage.keys.js';
import type { StorageDriver, StoredObject, StoredUpload, UploadKind } from './storage.types.js';

const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const allowedMaterialTypes = new Set(['application/pdf']);

export class LocalStorageDriver implements StorageDriver {
  private readonly root = resolve(env.UPLOAD_DIR);

  async save(file: MultipartFile, kind: UploadKind): Promise<StoredUpload> {
    const folder = objectFolder(kind);
    const temporaryKey = `${folder}/${randomUUID()}.uploading`;
    const temporaryPath = this.resolveKey(temporaryKey);
    await mkdir(resolve(this.root, folder), { recursive: true });

    const checksum = createHash('sha256');
    let byteSize = 0;
    file.file.on('data', (chunk: Buffer) => {
      byteSize += chunk.length;
      checksum.update(chunk);
    });
    try {
      await pipeline(file.file, createWriteStream(temporaryPath, { flags: 'wx' }));
      if (file.file.truncated) {
        throw new AppError(413, 'Uploaded file is too large', 'UPLOAD_TOO_LARGE');
      }
      const detected = await fileTypeFromFile(temporaryPath);
      const mimeType = detected?.mime ?? file.mimetype;
      const allowed = kind === 'video' ? allowedVideoTypes : allowedMaterialTypes;
      const sizeLimit = kind === 'video' ? env.UPLOAD_MAX_FILE_BYTES : env.MATERIAL_MAX_FILE_BYTES;
      if (!allowed.has(mimeType)) {
        throw new AppError(415, `Unsupported ${kind} file type`, 'UNSUPPORTED_FILE_TYPE');
      }
      if (byteSize > sizeLimit) {
        throw new AppError(413, 'Uploaded file is too large', 'UPLOAD_TOO_LARGE');
      }

      const extension = detected?.ext ? `.${detected.ext}` : extname(file.filename).toLowerCase();
      const storageKey = `${folder}/${randomUUID()}${extension}`;
      await rename(temporaryPath, this.resolveKey(storageKey));
      return {
        storageKey,
        originalName: file.filename.slice(0, 255),
        mimeType,
        byteSize: BigInt(byteSize),
        checksum: checksum.digest('hex'),
      };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  resolveKey(storageKey: string): string {
    const filePath = resolve(this.root, assertSafeStorageKey(storageKey));
    if (filePath !== this.root && !filePath.startsWith(`${this.root}${sep}`)) {
      throw new AppError(400, 'Invalid storage key', 'INVALID_STORAGE_KEY');
    }
    return filePath;
  }

  async stat(storageKey: string): Promise<{ size: number }> {
    const details = await stat(this.resolveKey(storageKey));
    return { size: details.size };
  }

  async open(storageKey: string, range?: { start: number; end: number }): Promise<StoredObject> {
    const path = this.resolveKey(storageKey);
    const details = await stat(path);
    return {
      details: { size: details.size },
      stream: createReadStream(path, range),
    };
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }
}
