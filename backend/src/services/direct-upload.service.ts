import type { PrismaClient } from '../generated/prisma/client.js';
import {
  AccessLevel,
  ContentStatus,
  ResourceType,
  VideoType,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { assertAllowedUpload, extensionForMime } from './media-upload.constants.js';
import type { MediaService, ResourceInput, VideoInput } from './media.service.js';
import { createObjectKey } from './storage.keys.js';
import type { StorageService } from './storage.service.js';
import type { UploadKind } from './storage.types.js';
import {
  issueDirectUploadAuthorization,
  verifyDirectUploadAuthorization,
} from './upload-authorization.js';

export interface DirectUploadRequest {
  kind: UploadKind;
  mimeType: string;
  byteSize: number;
  originalName: string;
  title: string;
  type?: string | undefined;
  position?: number | undefined;
  status?: string | undefined;
  accessLevel?: string | undefined;
  durationSeconds?: number | undefined;
  isDownload?: boolean | undefined;
}

export class DirectUploadService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly media: MediaService,
  ) {}

  uploadMode() {
    return { directUpload: this.storage.supportsDirectUpload() };
  }

  async authorize(userId: string, lessonId: string, input: DirectUploadRequest) {
    if (!this.storage.supportsDirectUpload()) {
      throw new AppError(409, 'Direct upload requires R2 storage', 'DIRECT_UPLOAD_UNAVAILABLE');
    }
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    assertAllowedUpload(input.kind, input.mimeType, input.byteSize);
    const videoInput = input.kind === 'video' ? parseVideoInput(input) : undefined;
    const resourceInput = input.kind === 'material' ? parseResourceInput(input) : undefined;
    const metadata = input.kind === 'video' ? videoInput! : resourceInput!;
    const storageKey = createObjectKey(input.kind, extensionForMime(input.mimeType));
    const signed = await this.storage.presignPut(storageKey, input.mimeType);
    const authorization = issueDirectUploadAuthorization({
      sub: userId,
      lessonId,
      kind: input.kind,
      storageKey,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      originalName: input.originalName.slice(0, 255),
      title: input.title,
      type: metadata.type,
      position: metadata.position,
      ...(videoInput?.status !== undefined ? { status: videoInput.status } : {}),
      ...(videoInput?.accessLevel !== undefined ? { accessLevel: videoInput.accessLevel } : {}),
      ...(videoInput?.durationSeconds !== undefined
        ? { durationSeconds: videoInput.durationSeconds }
        : {}),
      ...(resourceInput?.isDownload !== undefined ? { isDownload: resourceInput.isDownload } : {}),
    });
    return {
      authorization: authorization.token,
      storageKey,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers,
      expiresIn: authorization.expiresIn,
      expiresAt: authorization.expiresAt,
      method: 'PUT' as const,
    };
  }

  async finalize(userId: string, token: string) {
    const authorization = verifyDirectUploadAuthorization(token, userId);
    if (!this.storage.supportsDirectUpload()) {
      throw new AppError(409, 'Direct upload requires R2 storage', 'DIRECT_UPLOAD_UNAVAILABLE');
    }
    const existing = await this.prisma.fileAsset.findUnique({
      where: { storageKey: authorization.storageKey },
    });
    if (existing) {
      throw new AppError(409, 'Upload authorization has already been used', 'UPLOAD_AUTHORIZATION_REUSED');
    }

    let object: { size: number; mimeType: string | null; checksum: string | null };
    try {
      object = await this.storage.headObject(authorization.storageKey);
    } catch (error) {
      if (error instanceof AppError && error.code === 'STORAGE_OBJECT_NOT_FOUND') {
        throw new AppError(409, 'Uploaded object was not found', 'UPLOAD_OBJECT_MISSING');
      }
      throw error;
    }
    if (object.size !== authorization.byteSize) {
      throw new AppError(409, 'Uploaded object size does not match the authorization', 'UPLOAD_SIZE_MISMATCH');
    }
    const actualType = (object.mimeType ?? '').split(';')[0]?.trim().toLowerCase();
    if (actualType && actualType !== authorization.mimeType) {
      throw new AppError(409, 'Uploaded object type does not match the authorization', 'UPLOAD_TYPE_MISMATCH');
    }

    const upload = {
      storageKey: authorization.storageKey,
      originalName: authorization.originalName,
      mimeType: authorization.mimeType,
      byteSize: BigInt(authorization.byteSize),
      checksum: object.checksum ?? `etag:${authorization.jti}`,
      storageProvider: 'r2',
    };

    try {
      if (authorization.kind === 'video') {
        return {
          kind: 'video' as const,
          record: await this.media.createVideo(authorization.lessonId, {
            title: authorization.title,
            type: authorization.type as VideoType,
            position: authorization.position,
            status: (authorization.status as ContentStatus | undefined) ?? ContentStatus.DRAFT,
            accessLevel: (authorization.accessLevel as AccessLevel | undefined) ?? AccessLevel.LOCKED,
            durationSeconds: authorization.durationSeconds,
          }, upload),
        };
      }
      return {
        kind: 'material' as const,
        record: await this.media.createResource(authorization.lessonId, {
          title: authorization.title,
          type: authorization.type as ResourceType,
          position: authorization.position,
          isDownload: authorization.isDownload ?? true,
        }, upload),
      };
    } catch (error) {
      await this.storage.remove(authorization.storageKey, 'r2').catch(() => undefined);
      throw error;
    }
  }
}

function parseVideoInput(input: DirectUploadRequest): VideoInput {
  const parsed = {
    title: input.title,
    type: VideoType[input.type as keyof typeof VideoType],
    position: input.position ?? 0,
    status: (input.status as ContentStatus | undefined) ?? ContentStatus.DRAFT,
    accessLevel: (input.accessLevel as AccessLevel | undefined) ?? AccessLevel.LOCKED,
    durationSeconds: input.durationSeconds,
  };
  if (!parsed.type) throw new AppError(400, 'Invalid video type', 'VALIDATION_ERROR');
  return parsed;
}

function parseResourceInput(input: DirectUploadRequest): ResourceInput {
  return {
    title: input.title,
    type: ResourceType.PDF,
    position: input.position ?? 0,
    isDownload: input.isDownload ?? true,
  };
}
