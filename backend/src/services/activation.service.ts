import { createHash, randomBytes } from 'node:crypto';
import {
  ActivationCodeStatus,
  ActivationUnlockType,
  ContentStatus,
  CourseStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

export class ActivationService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(target: { unitId?: string | undefined; lessonId?: string | undefined }) {
    return this.prisma.activationCode.findMany({
      where: {
        ...(target.unitId ? { unitId: target.unitId } : {}),
        ...(target.lessonId ? { lessonId: target.lessonId } : {}),
        unlockType: { in: [ActivationUnlockType.UNIT, ActivationUnlockType.LESSON] },
      },
      select: {
        id: true, label: true, unlockType: true, unitId: true, lessonId: true,
        status: true, maxUses: true, usedCount: true, expiresAt: true,
        createdAt: true,
        unit: { select: { title: true } },
        lesson: { select: { title: true } },
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          select: { id: true, redeemedAt: true, student: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async myContent(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId }, select: { id: true },
    });
    if (!student) throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    const redemptions = await this.prisma.activationCodeRedemption.findMany({
      where: { studentId: student.id, activationCode: { unlockType: { in: ['UNIT', 'LESSON'] } } },
      orderBy: { redeemedAt: 'desc' },
      select: {
        id: true, redeemedAt: true,
        activationCode: {
          select: {
            unlockType: true,
            unit: {
              select: {
                id: true, title: true, status: true, deletedAt: true,
                course: { select: { title: true, status: true, deletedAt: true } },
                lessons: {
                  where: { status: ContentStatus.PUBLISHED, deletedAt: null },
                  orderBy: { position: 'asc' },
                  select: { id: true, title: true },
                },
              },
            },
            lesson: {
              select: {
                id: true, title: true, status: true, deletedAt: true,
                unit: { select: { id: true, title: true, status: true, deletedAt: true,
                  course: { select: { title: true, status: true, deletedAt: true } } } },
              },
            },
          },
        },
      },
    });
    return redemptions.flatMap((redemption) => {
      const code = redemption.activationCode;
      const unit = code.unlockType === 'UNIT' ? code.unit : code.lesson?.unit;
      if (!unit || unit.deletedAt || unit.status !== ContentStatus.PUBLISHED ||
        unit.course.deletedAt || unit.course.status !== CourseStatus.PUBLISHED) return [];
      const lessons = code.unlockType === 'UNIT' ? code.unit?.lessons ?? [] :
        code.lesson && !code.lesson.deletedAt && code.lesson.status === ContentStatus.PUBLISHED
          ? [{ id: code.lesson.id, title: code.lesson.title }] : [];
      return [{ id: redemption.id, redeemedAt: redemption.redeemedAt,
        courseTitle: unit.course.title, unitTitle: unit.title, lessons }];
    });
  }

  async create(
    input: {
      unlockType: 'UNIT' | 'LESSON';
      targetId: string;
      label?: string | undefined;
      maxUses: number;
      expiresAt?: Date | undefined;
      assignedStudentId?: string | undefined;
    },
    createdById: string,
  ) {
    if (input.unlockType === 'UNIT') {
      const target = await this.prisma.courseUnit.findFirst({ where: { id: input.targetId, deletedAt: null, course: { deletedAt: null } } });
      if (!target) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
    } else {
      const target = await this.prisma.lesson.findFirst({ where: { id: input.targetId, deletedAt: null, unit: { deletedAt: null, course: { deletedAt: null } } } });
      if (!target) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    }
    const code = randomBytes(18).toString('base64url').toUpperCase();
    const codeHash = createHash('sha256').update(code).digest('hex');
    const record = await this.prisma.activationCode.create({
      data: {
        codeHash,
        label: input.label ?? null,
        unlockType: input.unlockType,
        unitId: input.unlockType === 'UNIT' ? input.targetId : null,
        lessonId: input.unlockType === 'LESSON' ? input.targetId : null,
        maxUses: input.maxUses,
        expiresAt: input.expiresAt ?? null,
        assignedStudentId: input.assignedStudentId ?? null,
        createdById,
      },
      select: { id: true, label: true, unlockType: true, unitId: true, lessonId: true, status: true, maxUses: true, usedCount: true, expiresAt: true },
    });
    return { ...record, code };
  }

  async disable(id: string) {
    const current = await this.prisma.activationCode.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Activation code not found', 'ACTIVATION_CODE_NOT_FOUND');
    return this.prisma.activationCode.update({
      where: { id }, data: { status: ActivationCodeStatus.DISABLED },
      select: { id: true, status: true },
    });
  }

  async removeUnused(id: string) {
    const code = await this.prisma.activationCode.findUnique({
      where: { id }, select: { id: true, _count: { select: { redemptions: true } } },
    });
    if (!code) throw new AppError(404, 'Activation code not found', 'ACTIVATION_CODE_NOT_FOUND');
    if (code._count.redemptions) {
      throw new AppError(409, 'Redeemed codes cannot be deleted; disable the code instead', 'ACTIVATION_HAS_REDEMPTIONS');
    }
    await this.prisma.activationCode.delete({ where: { id } });
  }
  async redeem(userId: string, rawCode: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!student) throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    const codeHash = createHash('sha256').update(rawCode.trim().toUpperCase()).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      const code = await tx.activationCode.findUnique({
        where: { codeHash },
        include: {
          unit: { include: { course: true } },
          lesson: { include: { unit: { include: { course: true } } } },
          redemptions: { where: { studentId: student.id }, select: { id: true } },
        },
      });
      if (!code) throw new AppError(404, 'Activation code is invalid', 'ACTIVATION_INVALID');
      if (code.redemptions.length) throw new AppError(409, 'Code already redeemed by this student', 'ACTIVATION_ALREADY_USED');
      if (code.status !== ActivationCodeStatus.ACTIVE || code.usedCount >= code.maxUses) {
        throw new AppError(409, 'Activation code is no longer active', 'ACTIVATION_INACTIVE');
      }
      if (code.expiresAt && code.expiresAt <= new Date()) {
        throw new AppError(409, 'Activation code has expired', 'ACTIVATION_EXPIRED');
      }
      if (code.assignedStudentId && code.assignedStudentId !== student.id) {
        throw new AppError(403, 'Activation code belongs to another student', 'ACTIVATION_ASSIGNED');
      }
      const unit = code.unlockType === ActivationUnlockType.UNIT ? code.unit : code.lesson?.unit;
      if (!unit || unit.deletedAt || unit.status !== ContentStatus.PUBLISHED ||
          unit.course.deletedAt || unit.course.status !== CourseStatus.PUBLISHED ||
          (code.unlockType === ActivationUnlockType.LESSON &&
            (!code.lesson || code.lesson.deletedAt || code.lesson.status !== ContentStatus.PUBLISHED))) {
        throw new AppError(409, 'Target content is not published', 'ACTIVATION_TARGET_UNAVAILABLE');
      }
      const updated = await tx.activationCode.updateMany({
        where: { id: code.id, status: ActivationCodeStatus.ACTIVE, usedCount: { lt: code.maxUses } },
        data: { usedCount: { increment: 1 } },
      });
      if (!updated.count) throw new AppError(409, 'Activation code has reached its use limit', 'ACTIVATION_EXHAUSTED');
      await tx.activationCodeRedemption.create({
        data: { activationCodeId: code.id, studentId: student.id },
      });
      if (code.usedCount + 1 >= code.maxUses) {
        await tx.activationCode.update({ where: { id: code.id }, data: { status: ActivationCodeStatus.EXHAUSTED } });
      }
      return {
        unlockType: code.unlockType,
        unitId: code.unitId,
        lessonId: code.lessonId,
        title: code.unlockType === ActivationUnlockType.UNIT ? unit.title : code.lesson!.title,
      };
    });
  }
}
