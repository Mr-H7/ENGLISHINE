import {
  EnrollmentStatus,
  HomeworkStatus,
  type QuestionType,
  ReviewStatus,
  SubmissionStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

export interface HomeworkInput {
  lessonId: string;
  title: string;
  instructions?: string | undefined;
  status?: HomeworkStatus | undefined;
  maxScore?: number | undefined;
  dueAt?: Date | undefined;
  solutionVideoId?: string | undefined;
}

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  position: number;
  points?: number | undefined;
  correctText?: string | undefined;
  explanation?: string | undefined;
  choices?: { label: string; position: number; isCorrect?: boolean | undefined }[] | undefined;
}

export class HomeworkService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(lessonId?: string) {
    return this.prisma.homework.findMany({
      where: { deletedAt: null, ...(lessonId && { lessonId }) },
      include: {
        lesson: { select: { id: true, title: true } },
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, includeAnswers = true) {
    const homework = await this.prisma.homework.findFirst({
      where: { id, deletedAt: null },
      include: {
        lesson: { include: { unit: { select: { courseId: true } } } },
        questions: {
          orderBy: { position: 'asc' },
          include: { choices: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!homework) throw new AppError(404, 'Homework not found', 'HOMEWORK_NOT_FOUND');
    if (includeAnswers) return homework;
    return {
      ...homework,
      questions: homework.questions.map((question) => ({
        ...question,
        correctText: undefined,
        explanation: undefined,
        choices: question.choices.map((choice) => ({ ...choice, isCorrect: undefined })),
      })),
    };
  }

  async getForStudent(userId: string, id: string) {
    const homework = await this.get(id, false);
    if (homework.status !== HomeworkStatus.PUBLISHED) {
      throw new AppError(404, 'Homework not found', 'HOMEWORK_NOT_FOUND');
    }
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    const now = new Date();
    const enrolled = await this.prisma.courseEnrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: homework.lesson.unit.courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });
    if (!enrolled) throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    return homework;
  }

  async create(input: HomeworkInput) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: input.lessonId, deletedAt: null },
    });
    if (!lesson) throw new AppError(404, 'Lesson not found', 'LESSON_NOT_FOUND');
    return this.prisma.homework.create({
      data: {
        lessonId: input.lessonId,
        title: input.title,
        instructions: input.instructions ?? null,
        status: input.status ?? HomeworkStatus.DRAFT,
        maxScore: input.maxScore ?? null,
        dueAt: input.dueAt ?? null,
        solutionVideoId: input.solutionVideoId ?? null,
      },
    });
  }

  async update(id: string, input: InputPatch<HomeworkInput>) {
    await this.get(id);
    return this.prisma.homework.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.instructions !== undefined && { instructions: input.instructions || null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.maxScore !== undefined && { maxScore: input.maxScore }),
        ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
        ...(input.solutionVideoId !== undefined && {
          solutionVideoId: input.solutionVideoId || null,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.homework.update({
      where: { id },
      data: { deletedAt: new Date(), status: HomeworkStatus.ARCHIVED },
    });
  }

  async addQuestion(homeworkId: string, input: QuestionInput) {
    await this.get(homeworkId);
    return this.prisma.homeworkQuestion.create({
      data: {
        homeworkId,
        type: input.type,
        prompt: input.prompt,
        position: input.position,
        points: input.points ?? null,
        correctText: input.correctText ?? null,
        explanation: input.explanation ?? null,
        ...(input.choices
          ? {
              choices: {
                create: input.choices.map((choice) => ({
                  ...choice,
                  isCorrect: choice.isCorrect ?? false,
                })),
              },
            }
          : {}),
      },
      include: { choices: true },
    });
  }

  async submit(
    userId: string,
    homeworkId: string,
    answers: {
      questionId: string;
      selectedChoiceId?: string | undefined;
      textAnswer?: string | undefined;
    }[],
  ) {
    const homework = await this.get(homeworkId, false);
    if (homework.status !== HomeworkStatus.PUBLISHED)
      throw new AppError(409, 'Homework is not available', 'HOMEWORK_UNAVAILABLE');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    const now = new Date();
    const enrolled = await this.prisma.courseEnrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: homework.lesson.unit.courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });
    if (!enrolled)
      throw new AppError(403, 'Active course enrollment is required', 'ENROLLMENT_REQUIRED');
    const questionIds = new Set(homework.questions.map((question) => question.id));
    if (answers.some((answer) => !questionIds.has(answer.questionId)))
      throw new AppError(400, 'An answer references an invalid question', 'INVALID_QUESTION');
    const attemptNo =
      (await this.prisma.homeworkSubmission.count({
        where: { homeworkId, studentId: student.id },
      })) + 1;
    return this.prisma.homeworkSubmission.create({
      data: {
        homeworkId,
        studentId: student.id,
        attemptNo,
        status:
          homework.dueAt && homework.dueAt < new Date()
            ? SubmissionStatus.LATE
            : SubmissionStatus.SUBMITTED,
        reviewStatus: ReviewStatus.PENDING,
        submittedAt: new Date(),
        answers: {
          create: answers.map((answer) => ({
            questionId: answer.questionId,
            selectedChoiceId: answer.selectedChoiceId ?? null,
            textAnswer: answer.textAnswer ?? null,
          })),
        },
      },
      include: { answers: true },
    });
  }

  async review(
    submissionId: string,
    reviewerId: string,
    input: {
      score?: number | undefined;
      feedback?: string | undefined;
      reviewStatus: ReviewStatus;
    },
  ) {
    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new AppError(404, 'Submission not found', 'SUBMISSION_NOT_FOUND');
    return this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewStatus: input.reviewStatus,
        score: input.score ?? null,
        feedback: input.feedback ?? null,
      },
    });
  }
}
