import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  EnrollmentStatus,
  ExamStatus,
  HomeworkStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { hasScopedEntitlement } from './content-access.service.js';
import { ProgressionService } from './progression.service.js';

const freeAccess: AccessLevel[] = [AccessLevel.FREE, AccessLevel.PREVIEW];

export class StudentPlatformService {
  constructor(private readonly prisma: PrismaClient) {}

  async grades() {
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

  async profile(userId: string) {
    const profile = await this.studentForUser(userId);
    return this.prisma.studentProfile.findUnique({
      where: { id: profile.id },
      select: {
        id: true,
        fullName: true,
        parentName: true,
        studentPhone: true,
        parentPhone: true,
        avatarAssetId: true,
        grade: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
            stage: { select: { id: true, code: true, nameAr: true } },
          },
        },
      },
    });
  }

  async updateProfile(
    userId: string,
    input: {
      fullName?: string | undefined;
      studentPhone?: string | undefined;
      guardianPhone?: string | undefined;
      email?: string | null | undefined;
    },
  ) {
    const profile = await this.studentForUser(userId);
    const data: { fullName?: string; studentPhone?: string; parentPhone?: string } = {};
    if (input.fullName !== undefined) data.fullName = input.fullName.trim();
    if (input.studentPhone !== undefined) {
      const { normalizeEgyptianPhone } = await import('../utils/phone.js');
      data.studentPhone = normalizeEgyptianPhone(input.studentPhone);
      await this.prisma.user.update({ where: { id: userId }, data: { phone: data.studentPhone } });
    }
    if (input.guardianPhone !== undefined) {
      const { normalizeEgyptianPhone } = await import('../utils/phone.js');
      data.parentPhone = normalizeEgyptianPhone(input.guardianPhone);
    }
    if (input.email !== undefined) {
      const email = input.email?.trim().toLowerCase() || null;
      if (email) {
        const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
        if (taken) throw new AppError(409, 'An account already exists for this email.', 'EMAIL_EXISTS');
      }
      await this.prisma.user.update({ where: { id: userId }, data: { email } });
    }
    await this.prisma.studentProfile.update({ where: { id: profile.id }, data });
    return this.profile(userId);
  }

  async roadmap(userId: string, courseId: string) {
    const student = await this.studentForUser(userId);
    return new ProgressionService(this.prisma).courseRoadmap(student.id, courseId);
  }

  async explore(userId: string) {
    const student = await this.studentForUser(userId);
    if (!student.gradeId) return [];
    const now = new Date();
    return this.prisma.course.findMany({
      where: {
        gradeId: student.gradeId,
        status: CourseStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        accessLevel: true,
        grade: { select: { id: true, nameAr: true } },
        teachers: {
          where: { isPrimary: true },
          take: 1,
          select: { teacher: { select: { fullName: true } } },
        },
        enrollments: {
          where: {
            studentId: student.id,
            status: EnrollmentStatus.ACTIVE,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
          },
          take: 1,
          select: { id: true, status: true, expiresAt: true },
        },
        units: {
          where: { deletedAt: null, status: ContentStatus.PUBLISHED },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            accessLevel: true,
            coverAssetId: true,
          },
        },
      },
    });
  }

  async freeContent(userId: string) {
    const student = await this.studentForUser(userId);
    const gradeFilter = student.gradeId
      ? { OR: [{ gradeId: student.gradeId }, { gradeId: null }] }
      : {};
    const [videos, lessons] = await Promise.all([
      this.prisma.video.findMany({
        where: {
          accessLevel: { in: freeAccess },
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
          lesson: {
            status: ContentStatus.PUBLISHED,
            deletedAt: null,
            unit: {
              status: ContentStatus.PUBLISHED,
              deletedAt: null,
              course: { status: CourseStatus.PUBLISHED, deletedAt: null, ...gradeFilter },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
        select: {
          id: true,
          title: true,
          type: true,
          accessLevel: true,
          durationSeconds: true,
          lesson: {
            select: {
              id: true,
              title: true,
              unit: {
                select: {
                  title: true,
                  course: {
                    select: { id: true, title: true, grade: { select: { nameAr: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.lesson.findMany({
        where: {
          accessLevel: { in: freeAccess },
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
          unit: {
            status: ContentStatus.PUBLISHED,
            deletedAt: null,
            course: { status: CourseStatus.PUBLISHED, deletedAt: null, ...gradeFilter },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
        select: {
          id: true,
          title: true,
          accessLevel: true,
          unit: {
            select: {
              title: true,
              course: {
                select: { id: true, title: true, grade: { select: { nameAr: true } } },
              },
            },
          },
        },
      }),
    ]);
    return [
      ...videos.map((video) => ({
        ...video,
        contentKind: 'VIDEO' as const,
        streamPath: `/media/videos/${video.id}`,
      })),
      ...lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: 'SAMPLE_LESSON' as const,
        contentKind: 'LESSON' as const,
        accessLevel: lesson.accessLevel,
        durationSeconds: null,
        streamPath: null,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          unit: lesson.unit,
        },
      })),
    ];
  }

  async lesson(userId: string, lessonId: string) {
    const student = await this.studentForUser(userId);
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        unit: {
          status: ContentStatus.PUBLISHED,
          deletedAt: null,
          course: { status: CourseStatus.PUBLISHED, deletedAt: null },
        },
      },
      include: {
        unit: {
          include: {
            course: { select: { id: true, title: true, accessLevel: true } },
            coverAsset: { select: { id: true } },
          },
        },
        videos: {
          where: { status: ContentStatus.PUBLISHED, deletedAt: null },
          orderBy: { position: 'asc' },
        },
        resources: {
          orderBy: { position: 'asc' },
          select: { id: true, title: true, type: true },
        },
      },
    });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    const entitled = await hasScopedEntitlement(
      this.prisma, student.id, lesson.unit.course.id, lesson.unitId, lesson.id,
    );
    const lessonIsFree =
      freeAccess.includes(lesson.accessLevel) ||
      freeAccess.includes(lesson.unit.accessLevel) ||
      freeAccess.includes(lesson.unit.course.accessLevel);
    const hasFreeVideo = lesson.videos.some((video) => freeAccess.includes(video.accessLevel));
    if (!lessonIsFree && !hasFreeVideo && !entitled) {
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    if (!lessonIsFree && entitled) {
      await new ProgressionService(this.prisma).assertCanAccessLesson(userId, lessonId);
    }
    return {
      ...lesson,
      entitled,
      videos: lesson.videos
        .filter((video) => entitled || freeAccess.includes(video.accessLevel))
        .map((video) => ({ ...video, streamPath: `/media/videos/${video.id}` })),
      resources: lessonIsFree || entitled ? lesson.resources : [],
    };
  }

  async homework(userId: string) {
    const student = await this.studentForUser(userId);
    const now = new Date();
    return this.prisma.homework.findMany({
      where: {
        status: HomeworkStatus.PUBLISHED,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          status: ContentStatus.PUBLISHED,
          unit: {
            deletedAt: null,
            status: ContentStatus.PUBLISHED,
            course: {
              deletedAt: null,
              status: CourseStatus.PUBLISHED,
            },
          },
        },
        OR: [
          { lesson: { unit: { course: { enrollments: { some: {
            studentId: student.id, status: EnrollmentStatus.ACTIVE,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
          } } } } } },
          { lesson: { activationCodes: { some: { unlockType: 'LESSON',
            redemptions: { some: { studentId: student.id } },
          } } } },
          { lesson: { unit: { activationCodes: { some: { unlockType: 'UNIT',
            redemptions: { some: { studentId: student.id } },
          } } } } },
        ],
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        instructions: true,
        coverAssetId: true,
        dueAt: true,
        maxScore: true,
        lesson: {
          select: {
            id: true,
            title: true,
            unit: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
          },
        },
        submissions: {
          where: { studentId: student.id },
          orderBy: { attemptNo: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            reviewStatus: true,
            score: true,
            submittedAt: true,
          },
        },
      },
    });
  }

  async exams(userId: string) {
    const student = await this.studentForUser(userId);
    const now = new Date();
    return this.prisma.exam.findMany({
      where: {
        status: ExamStatus.PUBLISHED,
        deletedAt: null,
        course: {
          deletedAt: null,
          status: CourseStatus.PUBLISHED,
          enrollments: {
            some: {
              studentId: student.id,
              status: EnrollmentStatus.ACTIVE,
              OR: [{ startsAt: null }, { startsAt: { lte: now } }],
              AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
            },
          },
        },
      },
      orderBy: [{ opensAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        durationMinutes: true,
        maxAttempts: true,
        opensAt: true,
        closesAt: true,
        course: { select: { id: true, title: true } },
        attempts: {
          where: { studentId: student.id },
          orderBy: { attemptNo: 'desc' },
          select: {
            id: true,
            attemptNo: true,
            status: true,
            submittedAt: true,
            result: {
              select: { score: true, maxScore: true, percentage: true, passed: true },
            },
          },
        },
      },
    });
  }

  async progress(userId: string) {
    const student = await this.studentForUser(userId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
        course: { deletedAt: null, status: CourseStatus.PUBLISHED },
      },
      select: { courseId: true, course: { select: { id: true, title: true } } },
    });
    const activations = await this.prisma.activationCodeRedemption.findMany({
      where: { studentId: student.id },
      select: {
        activationCode: { select: { unit: { select: { courseId: true, course: { select: { id: true, title: true } } } } } },
      },
    });
    const courses = new Map<string, { id: string; title: string }>();
    for (const row of enrollments) courses.set(row.courseId, row.course);
    for (const row of activations) {
      const course = row.activationCode.unit?.course;
      if (course) courses.set(course.id, course);
    }
    const progression = new ProgressionService(this.prisma);
    return Promise.all(
      [...courses.values()].map(async (course) => ({
        course,
        units: await progression.courseRoadmap(student.id, course.id),
      })),
    );
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) {
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    }
    return student;
  }

}
