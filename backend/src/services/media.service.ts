import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  Prisma,
  type ResourceType,
  SubmissionStatus,
  SystemRole,
  type VideoType,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { isRetryableWriteConflict } from '../utils/prisma-conflict.js';
import { retireAssetIfUnreferenced } from './asset-lifecycle.service.js';
import { hasScopedEntitlement } from './content-access.service.js';
import { ProgressionService } from './progression.service.js';
import type { StoredUpload, StorageService } from './storage.service.js';

export interface VideoInput {
  title: string;
  type: VideoType;
  position: number;
  status: ContentStatus;
  accessLevel: AccessLevel;
  durationSeconds?: number | undefined;
}

export interface ResourceInput {
  title: string;
  type: ResourceType;
  position: number;
  isDownload: boolean;
}

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

const POSITION_CONFLICT = new AppError(
  409,
  'يوجد تعارض مع البيانات الحالية. حدّث الصفحة وحاول مرة أخرى.',
  'CONFLICT',
);

export class MediaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  async createVideo(lessonId: string, input: VideoInput, upload: StoredUpload) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Unique (lessonId, position) includes soft-deleted Videos. Visible
            // counts and authorize-ticket positions are not authoritative.
            const existing = await tx.video.aggregate({
              where: { lessonId },
              _max: { position: true },
            });
            const nextPosition = (existing._max.position ?? -1) + 1;
            const asset = await tx.fileAsset.create({
              data: {
                isPublic: false,
                ...upload,
                storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER,
              },
            });
            return tx.video.create({
              data: {
                lessonId,
                fileAssetId: asset.id,
                title: input.title,
                type: input.type,
                position: Math.max(input.position, nextPosition),
                status: input.status,
                accessLevel: input.accessLevel,
                durationSeconds: input.durationSeconds ?? null,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableWriteConflict(error) || attempt === 3) {
          if (isRetryableWriteConflict(error)) throw POSITION_CONFLICT;
          throw error;
        }
      }
    }
    throw POSITION_CONFLICT;
  }

  async createResource(lessonId: string, input: ResourceInput, upload: StoredUpload) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: {
          isPublic: false,
          ...upload,
          storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER,
        },
      });
      return tx.lessonResource.create({
        data: { lessonId, assetId: asset.id, ...input },
        include: { asset: true },
      });
    });
  }

  async updateVideo(id: string, input: InputPatch<VideoInput>) {
    const video = await this.prisma.video.findFirst({ where: { id, deletedAt: null } });
    if (!video) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    try {
      return await this.prisma.video.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.position !== undefined && { position: input.position }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.accessLevel !== undefined && { accessLevel: input.accessLevel }),
          ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
        },
      });
    } catch (error) {
      if (isRetryableWriteConflict(error)) throw POSITION_CONFLICT;
      throw error;
    }
  }

  async updateResource(id: string, input: InputPatch<ResourceInput>) {
    const resource = await this.prisma.lessonResource.findUnique({ where: { id } });
    if (!resource) throw new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND');
    return this.prisma.lessonResource.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.isDownload !== undefined && { isDownload: input.isDownload }),
      },
    });
  }

  async replaceVideo(id: string, upload: StoredUpload) {
    const current = await this.prisma.video.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: { isPublic: false, ...upload, storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER },
      });
      return tx.video.update({ where: { id }, data: { fileAssetId: asset.id } });
    });
    if (current.fileAssetId) await retireAssetIfUnreferenced(this.prisma, this.storage, current.fileAssetId);
    return updated;
  }

  async replaceResource(id: string, upload: StoredUpload) {
    const current = await this.prisma.lessonResource.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND');
    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: { isPublic: false, ...upload, storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER },
      });
      return tx.lessonResource.update({ where: { id }, data: { assetId: asset.id } });
    });
    await retireAssetIfUnreferenced(this.prisma, this.storage, current.assetId);
    return updated;
  }

  async removeVideo(id: string) {
    const video = await this.prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: { homeworkSolution: { select: { id: true } } },
    });
    if (!video) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    if (video.homeworkSolution) throw new AppError(409, 'Remove the homework solution link before removing this video', 'VIDEO_HAS_DEPENDENCIES');
    await this.prisma.video.update({
      where: { id },
      data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED, fileAssetId: null },
    });
    if (video.fileAssetId) await retireAssetIfUnreferenced(this.prisma, this.storage, video.fileAssetId);
  }

  async removeResource(id: string) {
    const resource = await this.prisma.lessonResource.findUnique({ where: { id } });
    if (!resource) throw new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND');
    await this.prisma.lessonResource.delete({ where: { id } });
    await retireAssetIfUnreferenced(this.prisma, this.storage, resource.assetId);
  }

  async getVideoAsset(videoId: string, userId: string, roles: SystemRole[]) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: videoId,
        deletedAt: null,
        status: ContentStatus.PUBLISHED,
        lesson: {
          deletedAt: null,
          status: ContentStatus.PUBLISHED,
          unit: {
            deletedAt: null,
            status: ContentStatus.PUBLISHED,
            course: { deletedAt: null, status: CourseStatus.PUBLISHED },
          },
        },
      },
      include: {
        fileAsset: true,
        lesson: { include: { unit: { include: { course: true } } } },
        homeworkSolution: true,
      },
    });
    if (!video?.fileAsset) throw new AppError(404, 'Video file not found', 'VIDEO_NOT_FOUND');
    if (roles.some((role) => role !== SystemRole.STUDENT)) return video.fileAsset;
    const student = await this.studentForUser(userId);
    // A video's explicit access level wins; a free parent never exposes a paid child.
    const hasFreeAccess = video.accessLevel === AccessLevel.FREE || video.accessLevel === AccessLevel.PREVIEW;
    const entitled = hasFreeAccess || await hasScopedEntitlement(
      this.prisma, student.id, video.lesson.unit.courseId, video.lesson.unitId, video.lessonId,
    );
    if (!entitled) {
      throw new AppError(403, 'Course enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    if (!hasFreeAccess) {
      await new ProgressionService(this.prisma).assertCanAccessLesson(userId, video.lessonId);
    } else {
      await new ProgressionService(this.prisma).assertAssessmentDependencies(student.id, video.lessonId, video.lesson.unitId);
    }
    if (video.homeworkSolution) {
      const submitted = await this.prisma.homeworkSubmission.findFirst({
        where: {
          homeworkId: video.homeworkSolution.id,
          studentId: student.id,
          status: {
            in: [SubmissionStatus.SUBMITTED, SubmissionStatus.RETURNED, SubmissionStatus.LATE],
          },
        },
      });
      if (!submitted) {
        throw new AppError(
          403,
          'Homework must be submitted before viewing the solution',
          'HOMEWORK_REQUIRED',
        );
      }
    }
    return video.fileAsset;
  }

  async getResourceAsset(resourceId: string, userId: string, roles: SystemRole[]) {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id: resourceId },
      include: {
        asset: true,
        lesson: { include: { unit: { include: { course: true } } } },
      },
    });
    if (
      !resource ||
      resource.asset.deletedAt ||
      resource.lesson.deletedAt ||
      resource.lesson.status !== ContentStatus.PUBLISHED ||
      resource.lesson.unit.deletedAt ||
      resource.lesson.unit.status !== ContentStatus.PUBLISHED ||
      resource.lesson.unit.course.deletedAt ||
      resource.lesson.unit.course.status !== CourseStatus.PUBLISHED
    ) {
      throw new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND');
    }
    if (roles.some((role) => role !== SystemRole.STUDENT)) return resource.asset;
    const student = await this.studentForUser(userId);
    const hasFreeAccess = [resource.lesson.accessLevel, resource.lesson.unit.accessLevel, resource.lesson.unit.course.accessLevel]
      .some((level) => level === AccessLevel.FREE || level === AccessLevel.PREVIEW);
    if (!hasFreeAccess && !(await hasScopedEntitlement(
      this.prisma, student.id, resource.lesson.unit.courseId, resource.lesson.unitId, resource.lessonId,
    ))) throw new AppError(403, 'Content activation or enrollment is required', 'ENROLLMENT_REQUIRED');
    if (!hasFreeAccess) {
      await new ProgressionService(this.prisma).assertCanAccessLesson(userId, resource.lessonId);
    }
    return resource.asset;
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }

}
