import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  Prisma,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

function countedLabel(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeCourseDeletionConflict(counts: {
  units: number;
  lessons: number;
  videos: number;
  resources: number;
  homework: number;
  exams: number;
  enrollments: number;
  codes: number;
  redemptions: number;
  productLinks: number;
  lessonProgress: number;
  videoProgress: number;
  examAttempts: number;
  homeworkSubmissions: number;
  requirements: number;
  certificates: number;
}) {
  const blockers = [
    countedLabel(counts.units, 'وحدة مرتبطة', 'وحدات مرتبطة'),
    countedLabel(counts.lessons, 'درس مرتبط', 'دروس مرتبطة'),
    countedLabel(counts.videos, 'فيديو مرتبط', 'فيديوهات مرتبطة'),
    countedLabel(counts.resources, 'ملف مرتبط', 'ملفات مرتبطة'),
    countedLabel(counts.homework, 'واجب مرتبط', 'واجبات مرتبطة'),
    countedLabel(counts.exams, 'اختبار مرتبط', 'اختبارات مرتبطة'),
    counts.enrollments ? 'يوجد تسجيلات طلاب' : null,
    counts.lessonProgress || counts.videoProgress ? 'يوجد تقدم دراسي محفوظ' : null,
    counts.examAttempts ? 'يوجد محاولات اختبارات محفوظة' : null,
    counts.homeworkSubmissions ? 'يوجد محاولات واجبات محفوظة' : null,
    counts.certificates ? 'توجد شهادات محفوظة' : null,
    counts.codes || counts.redemptions || counts.productLinks ? 'يوجد وصول/تفعيل مرتبط' : null,
    counts.requirements ? 'توجد متطلبات تقدم مرتبطة' : null,
  ].filter((item): item is string => Boolean(item));
  if (!blockers.length) return null;
  const protectedHistory = Boolean(
    counts.enrollments ||
      counts.lessonProgress ||
      counts.videoProgress ||
      counts.examAttempts ||
      counts.homeworkSubmissions ||
      counts.certificates ||
      counts.redemptions,
  );
  const lines = ['لا يمكن حذف هذه الدورة.', ...blockers.map((item) => `- ${item}`)];
  if (protectedHistory) {
    lines.push('لا يمكن حذف الدورة بأمان لوجود سجل طلاب أو تقدم دراسي أو محاولات محفوظة.');
  } else {
    lines.push(
      'احذف المحتوى غير المستخدم أولًا بهذا الترتيب: الاختبارات، ثم الواجبات، ثم الفيديوهات أو الملفات، ثم الدروس، ثم الوحدات.',
    );
  }
  return { message: lines.join('\n'), protectedHistory, blockers };
}

export interface CourseInput {
  title: string;
  slug: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  gradeId?: string | undefined;
  academicTermId?: string | undefined;
  status?: CourseStatus | undefined;
  accessLevel?: AccessLevel | undefined;
}

export interface UnitInput {
  title: string;
  description?: string | undefined;
  academicTermId?: string | undefined;
  position: number;
  status?: ContentStatus | undefined;
  accessLevel?: AccessLevel | undefined;
  availableFrom?: Date | undefined;
}

export interface LessonInput {
  title: string;
  description?: string | undefined;
  position: number;
  status?: ContentStatus | undefined;
  accessLevel?: AccessLevel | undefined;
  estimatedMinutes?: number | undefined;
  availableFrom?: Date | undefined;
}

const courseSummary = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  status: true,
  accessLevel: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  grade: { select: { id: true, nameAr: true, nameEn: true } },
  academicTerm: { select: { id: true, type: true, academicYear: true } },
  _count: { select: { units: true, enrollments: true } },
} as const;

export class ContentService {
  constructor(private readonly prisma: PrismaClient) {}

  async listCourses(page: number, limit: number, publishedOnly = false) {
    const where = {
      deletedAt: null,
      ...(publishedOnly ? { status: CourseStatus.PUBLISHED } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        select: courseSummary,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.course.count({ where }),
    ]);
    return { items, total };
  }

  async getCourse(id: string, publishedOnly = false) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(publishedOnly ? { status: CourseStatus.PUBLISHED } : {}),
      },
      include: {
        grade: { include: { stage: true } },
        academicTerm: true,
        units: {
          where: { deletedAt: null, ...(publishedOnly ? { status: ContentStatus.PUBLISHED } : {}) },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: {
                deletedAt: null,
                ...(publishedOnly ? { status: ContentStatus.PUBLISHED } : {}),
              },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                position: true,
                status: true,
                accessLevel: true,
                estimatedMinutes: true,
                createdAt: true,
                _count: { select: { videos: true, resources: true, homework: true } },
              },
            },
          },
        },
      },
    });
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return course;
  }

  async createCourse(input: CourseInput, createdById: string) {
    return this.prisma.course.create({
      data: {
        title: input.title,
        slug: input.slug,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        gradeId: input.gradeId ?? null,
        academicTermId: input.academicTermId ?? null,
        status: input.status ?? CourseStatus.DRAFT,
        accessLevel: input.accessLevel ?? AccessLevel.ENROLLED,
        publishedAt: input.status === CourseStatus.PUBLISHED ? new Date() : null,
        createdById,
      },
      select: courseSummary,
    });
  }

  async updateCourse(id: string, input: InputPatch<CourseInput>) {
    const current = await this.prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return this.prisma.course.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.shortDescription !== undefined && {
          shortDescription: input.shortDescription || null,
        }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.gradeId !== undefined && { gradeId: input.gradeId || null }),
        ...(input.academicTermId !== undefined && {
          academicTermId: input.academicTermId || null,
        }),
        ...(input.accessLevel !== undefined && { accessLevel: input.accessLevel }),
        ...(input.status !== undefined && {
          status: input.status,
          publishedAt:
            input.status === CourseStatus.PUBLISHED
              ? (current.publishedAt ?? new Date())
              : current.publishedAt,
        }),
      },
      select: courseSummary,
    });
  }

  async deleteCourse(id: string) {
    const course = await this.prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    const inCourse = { unit: { courseId: id } };
    const [
      units, lessons, videos, resources, homework, exams, enrollments, codes, redemptions,
      productLinks, lessonProgress, legacyLessonProgress, videoProgress, legacyVideoProgress,
      examAttempts, homeworkSubmissions, requirements, certificates,
    ] = await Promise.all([
      this.prisma.courseUnit.count({ where: { courseId: id, deletedAt: null } }),
      this.prisma.lesson.count({ where: { unit: { courseId: id }, deletedAt: null } }),
      this.prisma.video.count({ where: { lesson: inCourse, deletedAt: null } }),
      this.prisma.lessonResource.count({ where: { lesson: inCourse } }),
      this.prisma.homework.count({ where: { lesson: inCourse, deletedAt: null } }),
      this.prisma.exam.count({ where: { courseId: id, deletedAt: null } }),
      this.prisma.courseEnrollment.count({ where: { courseId: id } }),
      this.prisma.activationCode.count({
        where: { OR: [{ courseId: id }, { unit: { courseId: id } }, { lesson: inCourse }] },
      }),
      this.prisma.activationCodeRedemption.count({
        where: {
          activationCode: { OR: [{ courseId: id }, { unit: { courseId: id } }, { lesson: inCourse }] },
        },
      }),
      this.prisma.productCourse.count({ where: { courseId: id } }),
      this.prisma.studentLessonProgress.count({ where: { lesson: inCourse } }),
      this.prisma.lessonProgress.count({ where: { lesson: inCourse } }),
      this.prisma.studentVideoProgress.count({ where: { video: { lesson: inCourse } } }),
      this.prisma.videoWatchProgress.count({ where: { video: { lesson: inCourse } } }),
      this.prisma.examAttempt.count({ where: { exam: { courseId: id } } }),
      this.prisma.homeworkSubmission.count({ where: { homework: { lesson: inCourse } } }),
      this.prisma.progressionRequirement.count({ where: { OR: [
        { unit: { courseId: id } }, { lesson: inCourse }, { targetId: id },
      ] } }),
      this.prisma.certificate.count({ where: { courseId: id } }),
    ]);
    const conflict = describeCourseDeletionConflict({
      units, lessons, videos, resources, homework, exams, enrollments, codes, redemptions,
      productLinks,
      lessonProgress: lessonProgress + legacyLessonProgress,
      videoProgress: videoProgress + legacyVideoProgress,
      examAttempts, homeworkSubmissions, requirements, certificates,
    });
    if (conflict) {
      throw new AppError(409, conflict.message, 'COURSE_HAS_DEPENDENCIES', {
        blockers: conflict.blockers,
        protectedHistory: conflict.protectedHistory,
      });
    }
    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), status: CourseStatus.ARCHIVED },
    });
  }

  async createUnit(courseId: string, input: UnitInput) {
    await this.getCourse(courseId);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // The unique index also includes soft-deleted Units. Visible counts are
          // not positions; append after every reserved position in this Course.
          const existing = await tx.courseUnit.aggregate({
            where: { courseId }, _max: { position: true },
          });
          const nextPosition = (existing._max.position ?? -1) + 1;
          return tx.courseUnit.create({
            data: {
              courseId,
              title: input.title,
              description: input.description ?? null,
              academicTermId: input.academicTermId ?? null,
              position: Math.max(input.position, nextPosition),
              status: input.status ?? ContentStatus.DRAFT,
              accessLevel: input.accessLevel ?? AccessLevel.ENROLLED,
              availableFrom: input.availableFrom ?? null,
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        // Concurrent appends/reorders may invalidate the snapshot. Retry the
        // complete allocation, never the insert with the stale position.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2002', 'P2034'].includes(error.code) || attempt === 3) throw error;
      }
    }
    throw new AppError(409, 'تعذر ترتيب الوحدة. أعد المحاولة.', 'CONFLICT');
  }

  async updateUnit(id: string, input: InputPatch<UnitInput>) {
    const unit = await this.prisma.courseUnit.findFirst({ where: { id, deletedAt: null } });
    if (!unit) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
    return this.prisma.courseUnit.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.academicTermId !== undefined && {
          academicTermId: input.academicTermId || null,
        }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.accessLevel !== undefined && { accessLevel: input.accessLevel }),
        ...(input.availableFrom !== undefined && { availableFrom: input.availableFrom }),
      },
    });
  }

  async deleteUnit(id: string) {
    const unit = await this.prisma.courseUnit.findFirst({ where: { id, deletedAt: null } });
    if (!unit) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
    const [lessons, codes, exams, lessonProgress, legacyProgress, videoProgress, legacyVideoProgress, examAttempts, homeworkSubmissions, requirements, productLinks] = await Promise.all([
      this.prisma.lesson.count({ where: { unitId: id, deletedAt: null } }),
      this.prisma.activationCode.count({ where: { unitId: id } }),
      this.prisma.exam.count({ where: { unitId: id, deletedAt: null } }),
      this.prisma.studentLessonProgress.count({ where: { lesson: { unitId: id } } }),
      this.prisma.lessonProgress.count({ where: { lesson: { unitId: id } } }),
      this.prisma.studentVideoProgress.count({ where: { video: { lesson: { unitId: id } } } }),
      this.prisma.videoWatchProgress.count({ where: { video: { lesson: { unitId: id } } } }),
      this.prisma.examAttempt.count({ where: { exam: { unitId: id } } }),
      this.prisma.homeworkSubmission.count({ where: { homework: { lesson: { unitId: id } } } }),
      this.prisma.progressionRequirement.count({ where: { OR: [{ unitId: id }, { targetId: id }] } }),
      this.prisma.productUnit.count({ where: { unitId: id } }),
    ]);
    if (lessons || codes || exams || lessonProgress || legacyProgress || videoProgress || legacyVideoProgress || examAttempts || homeworkSubmissions || requirements || productLinks)
      throw new AppError(409, 'Unit has content, access, progression or student history', 'UNIT_HAS_DEPENDENCIES');
    await this.prisma.courseUnit.update({
      where: { id },
      data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
    });
  }

  async createLesson(unitId: string, input: LessonInput) {
    const unit = await this.prisma.courseUnit.findFirst({ where: { id: unitId, deletedAt: null } });
    if (!unit) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
    return this.prisma.lesson.create({
      data: {
        unitId,
        title: input.title,
        description: input.description ?? null,
        position: input.position,
        status: input.status ?? ContentStatus.DRAFT,
        accessLevel: input.accessLevel ?? AccessLevel.ENROLLED,
        estimatedMinutes: input.estimatedMinutes ?? null,
        availableFrom: input.availableFrom ?? null,
      },
    });
  }

  async getLesson(id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, deletedAt: null },
      include: {
        unit: { include: { course: { select: { id: true, title: true, status: true } } } },
        videos: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        resources: { orderBy: { position: 'asc' }, include: { asset: true } },
        homework: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    return lesson;
  }

  async updateLesson(id: string, input: InputPatch<LessonInput>) {
    await this.getLesson(id);
    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.accessLevel !== undefined && { accessLevel: input.accessLevel }),
        ...(input.estimatedMinutes !== undefined && {
          estimatedMinutes: input.estimatedMinutes,
        }),
        ...(input.availableFrom !== undefined && { availableFrom: input.availableFrom }),
      },
    });
  }

  async deleteLesson(id: string) {
    await this.getLesson(id);
    const [videos, resources, homework, codes, exams, progress, legacyProgress, videoProgress, legacyVideoProgress, examAttempts, homeworkSubmissions, requirements, productLinks] = await Promise.all([
      this.prisma.video.count({ where: { lessonId: id, deletedAt: null } }),
      this.prisma.lessonResource.count({ where: { lessonId: id } }),
      this.prisma.homework.count({ where: { lessonId: id, deletedAt: null } }),
      this.prisma.activationCode.count({ where: { lessonId: id } }),
      this.prisma.exam.count({ where: { lessonId: id, deletedAt: null } }),
      this.prisma.studentLessonProgress.count({ where: { lessonId: id } }),
      this.prisma.lessonProgress.count({ where: { lessonId: id } }),
      this.prisma.studentVideoProgress.count({ where: { video: { lessonId: id } } }),
      this.prisma.videoWatchProgress.count({ where: { video: { lessonId: id } } }),
      this.prisma.examAttempt.count({ where: { exam: { lessonId: id } } }),
      this.prisma.homeworkSubmission.count({ where: { homework: { lessonId: id } } }),
      this.prisma.progressionRequirement.count({ where: { OR: [{ lessonId: id }, { targetId: id }] } }),
      this.prisma.productLesson.count({ where: { lessonId: id } }),
    ]);
    if (videos || resources || homework || codes || exams || progress || legacyProgress || videoProgress || legacyVideoProgress || examAttempts || homeworkSubmissions || requirements || productLinks) {
      throw new AppError(
        409,
        'Lesson has content, access, progression or student history; remove unused dependencies first',
        'LESSON_HAS_DEPENDENCIES',
      );
    }
    await this.prisma.lesson.update({
      where: { id },
      data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
    });
  }
}
