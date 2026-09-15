import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

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
    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), status: CourseStatus.ARCHIVED },
    });
  }

  async createUnit(courseId: string, input: UnitInput) {
    await this.getCourse(courseId);
    return this.prisma.courseUnit.create({
      data: {
        courseId,
        title: input.title,
        description: input.description ?? null,
        academicTermId: input.academicTermId ?? null,
        position: input.position,
        status: input.status ?? ContentStatus.DRAFT,
        availableFrom: input.availableFrom ?? null,
      },
    });
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
        ...(input.availableFrom !== undefined && { availableFrom: input.availableFrom }),
      },
    });
  }

  async deleteUnit(id: string) {
    const unit = await this.prisma.courseUnit.findFirst({ where: { id, deletedAt: null } });
    if (!unit) throw new AppError(404, 'Unit not found', 'UNIT_NOT_FOUND');
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
    await this.prisma.lesson.update({
      where: { id },
      data: { deletedAt: new Date(), status: ContentStatus.ARCHIVED },
    });
  }
}
