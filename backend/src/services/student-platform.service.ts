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
        parentPhone: true,
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

  async updateGrade(userId: string, gradeId: string) {
    const [profile, grade] = await Promise.all([
      this.studentForUser(userId),
      this.prisma.grade.findFirst({ where: { id: gradeId, isActive: true } }),
    ]);
    if (!grade) throw new AppError(404, 'Grade not found', 'GRADE_NOT_FOUND');
    await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { gradeId: grade.id },
    });
    return this.profile(userId);
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
          include: { course: { select: { id: true, title: true, accessLevel: true } } },
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
    const enrollment = await this.activeEnrollment(student.id, lesson.unit.course.id);
    const lessonIsFree =
      freeAccess.includes(lesson.accessLevel) ||
      freeAccess.includes(lesson.unit.course.accessLevel);
    const hasFreeVideo = lesson.videos.some((video) => freeAccess.includes(video.accessLevel));
    if (!lessonIsFree && !hasFreeVideo && !enrollment) {
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    return {
      ...lesson,
      entitled: Boolean(enrollment),
      videos: lesson.videos
        .filter((video) => lessonIsFree || enrollment || freeAccess.includes(video.accessLevel))
        .map((video) => ({ ...video, streamPath: `/media/videos/${video.id}` })),
      resources: lessonIsFree || enrollment ? lesson.resources : [],
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
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        dueAt: true,
        maxScore: true,
        lesson: {
          select: {
            id: true,
            title: true,
            unit: { select: { course: { select: { id: true, title: true } } } },
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
    const now = new Date();
    return this.prisma.courseEnrollment.findMany({
      where: {
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        course: { deletedAt: null, status: CourseStatus.PUBLISHED },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        course: { select: { id: true, title: true } },
        courseProgress: {
          select: {
            status: true,
            completedLessons: true,
            totalLessons: true,
            progressPercent: true,
            completedAt: true,
          },
        },
      },
    });
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) {
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    }
    return student;
  }

  private async activeEnrollment(studentId: string, courseId: string) {
    const now = new Date();
    return this.prisma.courseEnrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      select: { id: true, status: true, expiresAt: true },
    });
  }
}
