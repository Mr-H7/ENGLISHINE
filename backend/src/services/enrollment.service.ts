import {
  ContentStatus,
  CourseStatus,
  type EnrollmentSource,
  EnrollmentStatus,
  ProgressStatus,
  SystemRole,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

export class EnrollmentService {
  constructor(private readonly prisma: PrismaClient) {}

  async listGrades() {
    return this.prisma.academicStage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        nameAr: true,
        grades: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
      },
    });
  }

  async updateStudentGrade(studentId: string, gradeId: string | null) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
    if (gradeId) {
      const grade = await this.prisma.grade.findFirst({ where: { id: gradeId, isActive: true } });
      if (!grade) throw new AppError(404, 'Grade not found', 'GRADE_NOT_FOUND');
    }
    return this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { gradeId },
      include: {
        user: { select: { email: true, status: true } },
        grade: true,
        _count: { select: { enrollments: true } },
      },
    });
  }

  async listStudents(page: number, limit: number, search?: string) {
    const where = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { email: true, status: true } },
          grade: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.studentProfile.count({ where }),
    ]);
    return { items, total };
  }

  async enroll(
    studentId: string,
    courseId: string,
    input: {
      status: EnrollmentStatus;
      source: EnrollmentSource;
      startsAt?: Date | undefined;
      expiresAt?: Date | undefined;
    },
  ) {
    const [student, course] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { id: studentId } }),
      this.prisma.course.findFirst({ where: { id: courseId, deletedAt: null } }),
    ]);
    if (!student) throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return this.prisma.courseEnrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: {
        studentId,
        courseId,
        status: input.status,
        source: input.source,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      update: {
        status: input.status,
        source: input.source,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        completedAt: null,
      },
      include: {
        student: { select: { id: true, fullName: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async updateEnrollment(
    id: string,
    input: {
      status?: EnrollmentStatus | undefined;
      startsAt?: Date | null | undefined;
      expiresAt?: Date | null | undefined;
    },
  ) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({ where: { id } });
    if (!enrollment) throw new AppError(404, 'Enrollment not found', 'ENROLLMENT_NOT_FOUND');
    return this.prisma.courseEnrollment.update({
      where: { id },
      data: {
        ...(input.status !== undefined && {
          status: input.status,
          completedAt: input.status === EnrollmentStatus.COMPLETED ? new Date() : null,
        }),
        ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      },
    });
  }

  async myCourses(userId: string) {
    const student = await this.studentForUser(userId);
    const now = new Date();
    return this.prisma.courseEnrollment.findMany({
      where: {
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        course: { status: CourseStatus.PUBLISHED, deletedAt: null },
      },
      include: {
        course: {
          include: {
            grade: { include: { stage: true } },
            academicTerm: true,
            _count: { select: { units: true } },
          },
        },
        courseProgress: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async myCourse(userId: string, courseId: string) {
    const student = await this.studentForUser(userId);
    const enrollment = await this.activeEnrollment(student.id, courseId);
    return this.prisma.courseEnrollment.findUnique({
      where: { id: enrollment.id },
      include: {
        course: {
          include: {
            grade: { include: { stage: true } },
            academicTerm: true,
            units: {
              where: { deletedAt: null, status: ContentStatus.PUBLISHED },
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  where: { deletedAt: null, status: ContentStatus.PUBLISHED },
                  orderBy: { position: 'asc' },
                  include: {
                    videos: {
                      where: { deletedAt: null, status: ContentStatus.PUBLISHED },
                      orderBy: { position: 'asc' },
                    },
                    resources: { orderBy: { position: 'asc' } },
                  },
                },
              },
            },
          },
        },
        lessonProgress: true,
        videoProgress: true,
        courseProgress: true,
      },
    });
  }

  async updateLessonProgress(userId: string, lessonId: string, status: ProgressStatus) {
    const { enrollment } = await this.enrollmentForLesson(userId, lessonId);
    const now = new Date();
    const progress = await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        status,
        startedAt: now,
        lastAccessedAt: now,
        completedAt: status === ProgressStatus.COMPLETED ? now : null,
      },
      update: {
        status,
        ...(status === ProgressStatus.NOT_STARTED && { startedAt: null }),
        lastAccessedAt: now,
        completedAt: status === ProgressStatus.COMPLETED ? now : null,
      },
    });
    await this.recalculateCourseProgress(enrollment.id, lessonId);
    return progress;
  }

  async updateVideoProgress(
    userId: string,
    videoId: string,
    watchedSeconds: number,
    durationSeconds?: number,
  ) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      include: { lesson: { include: { unit: true } } },
    });
    if (!video) throw new AppError(404, 'Video not found', 'VIDEO_NOT_FOUND');
    const student = await this.studentForUser(userId);
    const enrollment = await this.activeEnrollment(student.id, video.lesson.unit.courseId);
    const duration = durationSeconds ?? video.durationSeconds ?? null;
    const percent =
      duration && duration > 0
        ? Math.min(100, Math.round((watchedSeconds / duration) * 10_000) / 100)
        : 0;
    return this.prisma.videoWatchProgress.upsert({
      where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
      create: {
        enrollmentId: enrollment.id,
        videoId,
        watchedSeconds,
        durationSeconds: duration,
        progressPercent: percent,
        lastWatchedAt: new Date(),
        completedAt: percent >= 90 ? new Date() : null,
      },
      update: {
        watchedSeconds,
        durationSeconds: duration,
        progressPercent: percent,
        lastWatchedAt: new Date(),
        completedAt: percent >= 90 ? new Date() : null,
      },
    });
  }

  async assignRoles(actorRoles: SystemRole[], userId: string, roles: SystemRole[]) {
    if (roles.includes(SystemRole.SUPER_ADMIN) && !actorRoles.includes(SystemRole.SUPER_ADMIN)) {
      throw new AppError(
        403,
        'Only a super admin can assign the super admin role',
        'ROLE_FORBIDDEN',
      );
    }
    const existing = await this.prisma.role.findMany({ where: { key: { in: roles } } });
    if (existing.length !== roles.length)
      throw new AppError(400, 'One or more roles are unavailable', 'ROLE_NOT_SEEDED');
    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({ data: existing.map((role) => ({ userId, roleId: role.id })) });
      return tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, roles: { select: { role: true } } },
      });
    });
  }

  async listRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }

  private async activeEnrollment(studentId: string, courseId: string) {
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
    if (!enrollment)
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    return enrollment;
  }

  private async enrollmentForLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { unit: true },
    });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    const student = await this.studentForUser(userId);
    return { lesson, enrollment: await this.activeEnrollment(student.id, lesson.unit.courseId) };
  }

  private async recalculateCourseProgress(enrollmentId: string, lastLessonId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) return;
    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({
        where: {
          unit: { courseId: enrollment.courseId, deletedAt: null },
          deletedAt: null,
          status: ContentStatus.PUBLISHED,
        },
      }),
      this.prisma.lessonProgress.count({
        where: { enrollmentId, status: ProgressStatus.COMPLETED },
      }),
    ]);
    const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 10_000) / 100 : 0;
    await this.prisma.courseProgress.upsert({
      where: { enrollmentId },
      create: {
        enrollmentId,
        lastLessonId,
        totalLessons,
        completedLessons,
        progressPercent: percent,
        status:
          completedLessons === 0
            ? ProgressStatus.NOT_STARTED
            : completedLessons >= totalLessons
              ? ProgressStatus.COMPLETED
              : ProgressStatus.IN_PROGRESS,
        completedAt: totalLessons > 0 && completedLessons >= totalLessons ? new Date() : null,
      },
      update: {
        lastLessonId,
        totalLessons,
        completedLessons,
        progressPercent: percent,
        status:
          completedLessons === 0
            ? ProgressStatus.NOT_STARTED
            : completedLessons >= totalLessons
              ? ProgressStatus.COMPLETED
              : ProgressStatus.IN_PROGRESS,
        completedAt: totalLessons > 0 && completedLessons >= totalLessons ? new Date() : null,
      },
    });
  }
}
