import { EnrollmentStatus, type PrismaClient } from '../generated/prisma/client.js';

export async function hasScopedEntitlement(
  prisma: PrismaClient,
  studentId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
): Promise<boolean> {
  const now = new Date();
  const [enrollment, redemption] = await Promise.all([
    prisma.courseEnrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      select: { id: true },
    }),
    prisma.activationCodeRedemption.findFirst({
      where: {
        studentId,
        OR: [
          { activationCode: { unlockType: 'UNIT', unitId } },
          { activationCode: { unlockType: 'LESSON', lessonId } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(enrollment || redemption);
}
