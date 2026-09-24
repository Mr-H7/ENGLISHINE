import {
  AccessLevel,
  ContentStatus,
  ExamAttemptStatus,
  HomeworkStatus,
  ReviewStatus,
  SubmissionStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { hasScopedEntitlement } from './content-access.service.js';

export const VIDEO_COMPLETION_THRESHOLD = 90;

const freeAccess: AccessLevel[] = [AccessLevel.FREE, AccessLevel.PREVIEW];

export type ProgressionState = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

export interface RequirementStatus {
  key: string;
  label: string;
  complete: boolean;
  current: boolean;
}

export interface LessonProgression {
  lessonId: string;
  entitled: boolean;
  state: ProgressionState;
  progressPercent: number;
  requirements: RequirementStatus[];
}

export interface UnitProgression {
  unitId: string;
  entitled: boolean;
  state: ProgressionState;
  progressPercent: number;
  requirements: RequirementStatus[];
  lessons: LessonProgression[];
}

export class ProgressionService {
  constructor(private readonly prisma: PrismaClient) {}

  async courseRoadmap(studentId: string, courseId: string): Promise<UnitProgression[]> {
    const units = await this.prisma.courseUnit.findMany({
      where: { courseId, deletedAt: null, status: ContentStatus.PUBLISHED },
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null, status: ContentStatus.PUBLISHED },
          orderBy: { position: 'asc' },
          include: {
            videos: { where: { deletedAt: null, status: ContentStatus.PUBLISHED }, orderBy: { position: 'asc' } },
            homework: { where: { deletedAt: null, status: HomeworkStatus.PUBLISHED } },
            exams: { where: { deletedAt: null } },
          },
        },
        exams: { where: { deletedAt: null } },
        progressionRequirements: { orderBy: { position: 'asc' } },
      },
    });

    const result: UnitProgression[] = [];
    let previousComplete = true;
    for (const unit of units) {
      const entitled = await hasScopedEntitlement(
        this.prisma,
        studentId,
        courseId,
        unit.id,
        unit.lessons[0]?.id ?? '00000000-0000-0000-0000-000000000000',
      );
      const unitEntitled =
        entitled ||
        freeAccess.includes(unit.accessLevel) ||
        (await this.unitEntitled(studentId, courseId, unit.id));
      const lessons: LessonProgression[] = [];
      for (const lesson of unit.lessons) {
        lessons.push(
          await this.lessonProgression(studentId, courseId, unit.id, lesson, previousComplete, unitEntitled),
        );
      }
      const lessonComplete = lessons.length === 0 || lessons.every((item) => item.state === 'COMPLETED');
      const examRequirements = await this.examRequirements(studentId, unit.exams.map((exam) => exam.id));
      const configured = unit.progressionRequirements.filter((item) => item.type === 'PREVIOUS_UNIT_COMPLETE');
      const previousRequired = configured.length ? configured.length > 0 : true;
      const previousMet = !previousRequired || previousComplete;
      const complete = lessonComplete && examRequirements.every((item) => item.complete);
      const inProgress = lessons.some((item) => item.state === 'IN_PROGRESS' || item.state === 'COMPLETED');
      const state: ProgressionState = !previousMet
        ? 'LOCKED'
        : complete
          ? 'COMPLETED'
          : inProgress
            ? 'IN_PROGRESS'
            : 'AVAILABLE';
      const requirements: RequirementStatus[] = [
        { key: 'previous-unit', label: 'إكمال الوحدة السابقة', complete: previousMet, current: !previousMet },
        ...lessons.flatMap((lesson) => lesson.requirements),
        ...examRequirements,
      ];
      const currentIndex = requirements.findIndex((item) => !item.complete);
      const marked = requirements.map((item, index) => ({ ...item, current: index === currentIndex }));
      const percent = marked.length
        ? Math.round((marked.filter((item) => item.complete).length / marked.length) * 100)
        : complete
          ? 100
          : 0;
      result.push({
        unitId: unit.id,
        entitled: unitEntitled,
        state: unitEntitled ? state : state === 'LOCKED' ? 'LOCKED' : 'LOCKED',
        progressPercent: unitEntitled ? percent : 0,
        requirements: marked,
        lessons,
      });
      if (unitEntitled && state === 'LOCKED') {
        result[result.length - 1]!.state = 'LOCKED';
      } else if (!unitEntitled) {
        result[result.length - 1]!.state = 'LOCKED';
      }
      previousComplete = complete && unitEntitled;
    }
    return result;
  }

  async assertCanAccessLesson(userId: string, lessonId: string): Promise<void> {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { unit: { include: { course: true } } },
    });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    if (
      freeAccess.includes(lesson.accessLevel) ||
      freeAccess.includes(lesson.unit.accessLevel) ||
      freeAccess.includes(lesson.unit.course.accessLevel)
    ) {
      return;
    }
    const roadmap = await this.courseRoadmap(student.id, lesson.unit.courseId);
    const unit = roadmap.find((item) => item.unitId === lesson.unitId);
    const row = unit?.lessons.find((item) => item.lessonId === lessonId);
    if (!unit || !row) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    if (!row.entitled) {
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    }
    if (row.state === 'LOCKED') {
      throw new AppError(403, 'Complete the previous learning requirements first', 'PROGRESSION_LOCKED');
    }
  }

  private async unitEntitled(studentId: string, courseId: string, unitId: string) {
    return hasScopedEntitlement(
      this.prisma,
      studentId,
      courseId,
      unitId,
      '00000000-0000-0000-0000-000000000000',
    );
  }

  private async lessonProgression(
    studentId: string,
    courseId: string,
    unitId: string,
    lesson: {
      id: string;
      accessLevel: AccessLevel;
      videos: Array<{ id: string }>;
      homework: Array<{ id: string }>;
      exams: Array<{ id: string }>;
    },
    previousUnitComplete: boolean,
    unitEntitled: boolean,
  ): Promise<LessonProgression> {
    const entitled =
      unitEntitled ||
      freeAccess.includes(lesson.accessLevel) ||
      (await hasScopedEntitlement(this.prisma, studentId, courseId, unitId, lesson.id));
    const videoRows = await this.prisma.studentVideoProgress.findMany({
      where: { studentId, videoId: { in: lesson.videos.map((video) => video.id) } },
    });
    const videoRequirements = lesson.videos.map((video) => {
      const progress = videoRows.find((row) => row.videoId === video.id);
      const complete = Boolean(progress?.completedAt) || Number(progress?.progressPercent ?? 0) >= VIDEO_COMPLETION_THRESHOLD;
      return {
        key: `video:${video.id}`,
        label: 'Watch lesson',
        complete,
        current: false,
      };
    });
    const homeworkRequirements = await this.homeworkRequirements(studentId, lesson.homework.map((item) => item.id));
    const examRequirements = await this.examRequirements(studentId, lesson.exams.map((item) => item.id));
    const requirements = [...videoRequirements, ...homeworkRequirements, ...examRequirements];
    const complete = requirements.length === 0 || requirements.every((item) => item.complete);
    const started = requirements.some((item) => item.complete);
    const state: ProgressionState = !previousUnitComplete
      ? 'LOCKED'
      : !entitled
        ? 'LOCKED'
        : complete
          ? 'COMPLETED'
          : started
            ? 'IN_PROGRESS'
            : 'AVAILABLE';
    const percent = requirements.length
      ? Math.round((requirements.filter((item) => item.complete).length / requirements.length) * 100)
      : complete
        ? 100
        : 0;
    return { lessonId: lesson.id, entitled, state, progressPercent: percent, requirements };
  }

  private async homeworkRequirements(studentId: string, homeworkIds: string[]): Promise<RequirementStatus[]> {
    if (!homeworkIds.length) return [];
    const submissions = await this.prisma.homeworkSubmission.findMany({
      where: { studentId, homeworkId: { in: homeworkIds } },
      orderBy: { attemptNo: 'desc' },
    });
    return homeworkIds.flatMap((id) => {
      const latest = submissions.find((item) => item.homeworkId === id);
      const submitted = Boolean(
        latest &&
          (latest.status === SubmissionStatus.SUBMITTED ||
            latest.status === SubmissionStatus.LATE ||
            latest.status === SubmissionStatus.RETURNED),
      );
      const graded = latest?.reviewStatus === ReviewStatus.REVIEWED;
      return [
        { key: `homework-submit:${id}`, label: 'Submit homework', complete: submitted, current: false },
        { key: `homework-review:${id}`, label: 'Review homework/solution', complete: graded, current: false },
      ];
    });
  }

  private async examRequirements(studentId: string, examIds: string[]): Promise<RequirementStatus[]> {
    if (!examIds.length) return [];
    const attempts = await this.prisma.examAttempt.findMany({
      where: { studentId, examId: { in: examIds } },
      include: { result: true },
    });
    return examIds.map((id) => {
      const latest = attempts.filter((item) => item.examId === id);
      const submitted = latest.some(
        (item) => item.status === ExamAttemptStatus.SUBMITTED || item.status === ExamAttemptStatus.AUTO_SUBMITTED,
      );
      return { key: `exam:${id}`, label: 'Complete test', complete: submitted, current: false };
    });
  }
}
