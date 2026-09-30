import { ContentStatus, CourseStatus, type PrismaClient } from '../generated/prisma/client.js';

export interface ActivationScope {
  unitIds: string[];
  lessonIds: string[];
  redeemedAt: Date;
}

// Redemption is the grant. Code expiry/exhaustion controls future redemption,
// not the lifetime of an already redeemed grant (same as content-access.service).
export async function activationScopes(prisma: PrismaClient, studentId: string) {
  const rows = await prisma.activationCodeRedemption.findMany({
    where: { studentId, activationCode: { unlockType: { in: ['UNIT', 'LESSON'] } } },
    orderBy: [{ redeemedAt: 'desc' }, { id: 'asc' }],
    include: { activationCode: { include: {
      unit: { include: { course: true } },
      lesson: { include: { unit: { include: { course: true } } } },
    } } },
  });
  const scopes = new Map<string, ActivationScope>();
  for (const row of rows) {
    const code = row.activationCode;
    const unit = code.unlockType === 'UNIT' ? code.unit : code.lesson?.unit;
    if (!unit || unit.deletedAt || unit.status !== ContentStatus.PUBLISHED ||
      unit.course.deletedAt || unit.course.status !== CourseStatus.PUBLISHED ||
      (unit.course.publishedAt && unit.course.publishedAt > new Date()) ||
      (code.unlockType === 'LESSON' && (!code.lesson || code.lesson.deletedAt || code.lesson.status !== ContentStatus.PUBLISHED))) continue;
    const scope = scopes.get(unit.courseId) ?? { unitIds: [], lessonIds: [], redeemedAt: row.redeemedAt };
    if (code.unlockType === 'UNIT' && !scope.unitIds.includes(unit.id)) scope.unitIds.push(unit.id);
    if (code.unlockType === 'LESSON' && code.lessonId && !scope.lessonIds.includes(code.lessonId)) scope.lessonIds.push(code.lessonId);
    scopes.set(unit.courseId, scope);
  }
  return scopes;
}
