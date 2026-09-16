import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  EnrollmentStatus,
  type ResourceType,
  SubmissionStatus,
  SystemRole,
  type VideoType,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
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

export class MediaService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  async createVideo(lessonId: string, input: VideoInput, upload: StoredUpload) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: { storageProvider: env.STORAGE_DRIVER, isPublic: false, ...upload },
      });
      return tx.video.create({
        data: {
          lessonId,
          fileAssetId: asset.id,
          title: input.title,
          type: input.type,
          position: input.position,
          status: input.status,
          accessLevel: input.accessLevel,
          durationSeconds: input.durationSeconds ?? null,
        },
      });
    });
  }

  async createResource(lessonId: string, input: ResourceInput, upload: StoredUpload) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: { storageProvider: env.STORAGE_DRIVER, isPublic: false, ...upload },
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
    return this.prisma.video.update({
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
  }

  async removeVideo(id: string) {
    const video = await this.prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: { fileAsset: true },
    });
    if (!video) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    const storageKey = video.fileAsset?.storageKey;
    const storageProvider = video.fileAsset?.storageProvider;
    await this.prisma.$transaction([
      this.prisma.video.update({
        where: { id },
        data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED, fileAssetId: null },
      }),
      ...(video.fileAssetId
        ? [
            this.prisma.fileAsset.update({
              where: { id: video.fileAssetId },
              data: { deletedAt: new Date() },
            }),
          ]
        : []),
    ]);
    await this.removeUnreferencedObject(storageKey, storageProvider);
  }

  async removeResource(id: string) {
    const resource = await this.prisma.lessonResource.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!resource) throw new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND');
    const storageKey = resource.asset.storageKey;
    const storageProvider = resource.asset.storageProvider;
    await this.prisma.$transaction([
      this.prisma.lessonResource.delete({ where: { id } }),
      this.prisma.fileAsset.update({
        where: { id: resource.assetId },
        data: { deletedAt: new Date() },
      }),
    ]);
    await this.removeUnreferencedObject(storageKey, storageProvider);
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
    const hasFreeAccess = [
      video.accessLevel,
      video.lesson.accessLevel,
      video.lesson.unit.course.accessLevel,
    ].some((level) => level === AccessLevel.FREE || level === AccessLevel.PREVIEW);
    const enrollment = await this.activeEnrollment(student.id, video.lesson.unit.courseId);
    if (
      !enrollment && !hasFreeAccess
    ) {
      throw new AppError(403, 'Course enrollment is required', 'ENROLLMENT_REQUIRED');
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
    const hasFreeAccess = [resource.lesson.accessLevel, resource.lesson.unit.course.accessLevel]
      .some((level) => level === AccessLevel.FREE || level === AccessLevel.PREVIEW);
    if (!hasFreeAccess) {
      await this.activeEnrollment(student.id, resource.lesson.unit.courseId, true);
    }
    return resource.asset;
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }

  private async activeEnrollment(studentId: string, courseId: string, required = false) {
    const now = new Date();
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });
    if (!enrollment && required) {
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    return enrollment;
  }

  private async removeUnreferencedObject(
    storageKey: string | undefined,
    provider?: string,
  ): Promise<void> {
    if (!storageKey) return;
    const remaining = await this.prisma.fileAsset.count({
      where: { storageKey, deletedAt: null },
    });
    if (remaining > 0) return;
    await this.storage.remove(storageKey, provider);
  }
}
