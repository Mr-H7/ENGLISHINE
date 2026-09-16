import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import type { MultipartFile } from '@fastify/multipart';
import { fileTypeFromFile } from 'file-type';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { DIRECT_UPLOAD_TTL_SECONDS } from './media-upload.constants.js';
import { assertSafeStorageKey, objectFolder } from './storage.keys.js';
import type { StorageDriver, StoredObject, StoredUpload, UploadKind } from './storage.types.js';

const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const allowedMaterialTypes = new Set(['application/pdf']);
const stagingRoot = join(tmpdir(), 'englishine-r2-staging');
const partSizeBytes = 16 * 1024 * 1024;

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  const code = 'Code' in error ? String(error.Code) : '';
  const httpStatus =
    '$metadata' in error &&
    error.$metadata &&
    typeof error.$metadata === 'object' &&
    'httpStatusCode' in error.$metadata
      ? Number(error.$metadata.httpStatusCode)
      : undefined;
  return (
    name === 'NotFound' ||
    name === 'NoSuchKey' ||
    code === 'NoSuchKey' ||
    code === 'NotFound' ||
    httpStatus === 404
  );
}

function toNodeStream(body: unknown): Readable {
  if (body instanceof Readable) return body;
  throw new AppError(500, 'Unable to read stored object', 'STORAGE_STREAM_UNAVAILABLE');
}

export class R2StorageDriver implements StorageDriver {
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  private readonly bucket = env.R2_BUCKET;

  async save(file: MultipartFile, kind: UploadKind): Promise<StoredUpload> {
    const folder = objectFolder(kind);
    const stagingPath = join(stagingRoot, `${randomUUID()}.uploading`);
    await mkdir(stagingRoot, { recursive: true });

    const checksum = createHash('sha256');
    let byteSize = 0;
    file.file.on('data', (chunk: Buffer) => {
      byteSize += chunk.length;
      checksum.update(chunk);
    });

    try {
      await pipeline(file.file, createWriteStream(stagingPath, { flags: 'wx' }));
      if (file.file.truncated) {
        throw new AppError(413, 'Uploaded file is too large', 'UPLOAD_TOO_LARGE');
      }
      const detected = await fileTypeFromFile(stagingPath);
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
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: storageKey,
          Body: createReadStream(stagingPath),
          ContentType: mimeType,
          ContentLength: byteSize,
        },
        queueSize: 4,
        partSize: partSizeBytes,
        leavePartsOnError: false,
      });
      await upload.done();
      return {
        storageKey,
        originalName: file.filename.slice(0, 255),
        mimeType,
        byteSize: BigInt(byteSize),
        checksum: checksum.digest('hex'),
      };
    } finally {
      await rm(stagingPath, { force: true });
    }
  }

  async presignPut(
    storageKey: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; headers: Record<string, string>; expiresIn: number }> {
    const key = assertSafeStorageKey(storageKey);
    const expiresIn = DIRECT_UPLOAD_TTL_SECONDS;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      {
        expiresIn,
        signableHeaders: new Set(['content-type']),
      },
    );
    return {
      uploadUrl,
      headers: { 'content-type': mimeType },
      expiresIn,
    };
  }

  async headObject(
    storageKey: string,
  ): Promise<{ size: number; mimeType: string | null; checksum: string | null }> {
    const key = assertSafeStorageKey(storageKey);
    try {
      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const size = object.ContentLength;
      if (typeof size !== 'number') {
        throw new AppError(404, 'Stored object not found', 'STORAGE_OBJECT_NOT_FOUND');
      }
      return {
        size,
        mimeType: object.ContentType ?? null,
        checksum: object.ETag ? object.ETag.replaceAll('"', '') : null,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (isMissingObject(error)) {
        throw new AppError(404, 'Stored object not found', 'STORAGE_OBJECT_NOT_FOUND');
      }
      throw error;
    }
  }

  async stat(storageKey: string): Promise<{ size: number }> {
    const object = await this.headObject(storageKey);
    return { size: object.size };
  }

  async open(storageKey: string, range?: { start: number; end: number }): Promise<StoredObject> {
    const key = assertSafeStorageKey(storageKey);
    const details = await this.stat(key);
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(range
            ? { Range: `bytes=${range.start}-${range.end}` }
            : {}),
        }),
      );
      return {
        details,
        stream: toNodeStream(object.Body),
      };
    } catch (error) {
      if (isMissingObject(error)) {
        throw new AppError(404, 'Stored object not found', 'STORAGE_OBJECT_NOT_FOUND');
      }
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    const key = assertSafeStorageKey(storageKey);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (isMissingObject(error)) return;
      throw error;
    }
  }
}
