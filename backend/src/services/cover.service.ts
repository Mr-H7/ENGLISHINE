import {
  ContentStatus, CourseStatus, HomeworkStatus,
  type PrismaClient, type SystemRole,
} from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { hasScopedEntitlement } from './content-access.service.js';
import { retireAssetIfUnreferenced } from './asset-lifecycle.service.js';
import type { StoredUpload, StorageService } from './storage.service.js';

type CoverKind = 'unit' | 'homework';

export class CoverService {
  constructor(private readonly prisma: PrismaClient, private readonly storage: StorageService) {}

  private async target(kind: CoverKind, id: string) {
    if (kind === 'unit') {
      const unit = await this.prisma.courseUnit.findFirst({
        where: { id, deletedAt: null },
        include: { course: true, coverAsset: true },
      });
      if (!unit) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
      return { asset: unit.coverAsset, coverAssetId: unit.coverAssetId };
    }
    const homework = await this.prisma.homework.findFirst({
      where: { id, deletedAt: null },
      include: { coverAsset: true },
    });
    if (!homework) throw new AppError(404, 'Homework not found', 'HOMEWORK_NOT_FOUND');
    return { asset: homework.coverAsset, coverAssetId: homework.coverAssetId };
  }

  async replace(kind: CoverKind, id: string, upload: StoredUpload) {
    const current = await this.target(kind, id);
    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fileAsset.create({
        data: {
          isPublic: false,
          ...upload,
          storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER,
        },
      });
      if (kind === 'unit') {
        await tx.courseUnit.update({ where: { id }, data: { coverAssetId: created.id } });
      } else {
        await tx.homework.update({ where: { id }, data: { coverAssetId: created.id } });
      }
      return created;
    });
    if (current.coverAssetId) await retireAssetIfUnreferenced(this.prisma, this.storage, current.coverAssetId);
    return { id: asset.id, mimeType: asset.mimeType };
  }

  async remove(kind: CoverKind, id: string) {
    const current = await this.target(kind, id);
    if (!current.coverAssetId) return;
    if (kind === 'unit') {
      await this.prisma.courseUnit.update({ where: { id }, data: { coverAssetId: null } });
    } else {
      await this.prisma.homework.update({ where: { id }, data: { coverAssetId: null } });
    }
    await retireAssetIfUnreferenced(this.prisma, this.storage, current.coverAssetId);
  }

  async get(kind: CoverKind, id: string, userId: string, roles: SystemRole[]) {
    const staff = roles.some((role) => role !== 'STUDENT');
    if (kind === 'unit') {
      const unit = await this.prisma.courseUnit.findFirst({
        where: { id, deletedAt: null },
        include: { coverAsset: true, course: true },
      });
      if (!unit?.coverAsset || unit.coverAsset.deletedAt) throw new AppError(404, 'Cover not found', 'COVER_NOT_FOUND');
      if (!staff && (unit.status !== ContentStatus.PUBLISHED ||
          unit.course.status !== CourseStatus.PUBLISHED || unit.course.deletedAt)) {
        throw new AppError(404, 'Cover not found', 'COVER_NOT_FOUND');
      }
      return unit.coverAsset;
    }
    const homework = await this.prisma.homework.findFirst({
      where: { id, deletedAt: null },
      include: {
        coverAsset: true,
        lesson: { include: { unit: { include: { course: true } } } },
      },
    });
    if (!homework?.coverAsset || homework.coverAsset.deletedAt) throw new AppError(404, 'Cover not found', 'COVER_NOT_FOUND');
    if (!staff) {
      if (homework.status !== HomeworkStatus.PUBLISHED ||
          homework.lesson.status !== ContentStatus.PUBLISHED || homework.lesson.deletedAt ||
          homework.lesson.unit.status !== ContentStatus.PUBLISHED || homework.lesson.unit.deletedAt ||
          homework.lesson.unit.course.status !== CourseStatus.PUBLISHED || homework.lesson.unit.course.deletedAt) {
        throw new AppError(404, 'Cover not found', 'COVER_NOT_FOUND');
      }
      const student = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!student || !(await hasScopedEntitlement(
        this.prisma, student.id, homework.lesson.unit.courseId,
        homework.lesson.unitId, homework.lessonId,
      ))) throw new AppError(403, 'Homework activation or enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    return homework.coverAsset;
  }

}
