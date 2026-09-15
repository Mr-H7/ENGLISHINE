import {
  EnrollmentStatus,
  ExamAttemptStatus,
  ExamStatus,
  QuestionType,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

export interface ExamInput {
  courseId: string;
  lessonId?: string | undefined;
  title: string;
  instructions?: string | undefined;
  status?: ExamStatus | undefined;
  durationMinutes?: number | undefined;
  maxAttempts?: number | undefined;
  passingPercentage?: number | undefined;
  opensAt?: Date | undefined;
  closesAt?: Date | undefined;
}

export class ExamService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(courseId?: string) {
    return this.prisma.exam.findMany({
      where: { deletedAt: null, ...(courseId && { courseId }) },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { sections: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, includeAnswers = true) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: {
            questions: {
              orderBy: { position: 'asc' },
              include: { choices: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
    });
    if (!exam) throw new AppError(404, 'Exam not found', 'EXAM_NOT_FOUND');
    if (includeAnswers) return exam;
    return {
      ...exam,
      sections: exam.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
          ...question,
          correctText: undefined,
          explanation: undefined,
          choices: question.choices.map((choice) => ({ ...choice, isCorrect: undefined })),
        })),
      })),
    };
  }

  async create(input: ExamInput) {
    const course = await this.prisma.course.findFirst({
      where: { id: input.courseId, deletedAt: null },
    });
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return this.prisma.exam.create({
      data: {
        courseId: input.courseId,
        lessonId: input.lessonId ?? null,
        title: input.title,
        instructions: input.instructions ?? null,
        status: input.status ?? ExamStatus.DRAFT,
        durationMinutes: input.durationMinutes ?? null,
        maxAttempts: input.maxAttempts ?? 1,
        passingPercentage: input.passingPercentage ?? null,
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
        publishedAt: input.status === ExamStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async update(id: string, input: InputPatch<ExamInput>) {
    const current = await this.get(id);
    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(input.courseId !== undefined && { courseId: input.courseId }),
        ...(input.lessonId !== undefined && { lessonId: input.lessonId || null }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.instructions !== undefined && { instructions: input.instructions || null }),
        ...(input.status !== undefined && {
          status: input.status,
          publishedAt:
            input.status === ExamStatus.PUBLISHED
              ? (current.publishedAt ?? new Date())
              : current.publishedAt,
        }),
        ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
        ...(input.maxAttempts !== undefined && { maxAttempts: input.maxAttempts }),
        ...(input.passingPercentage !== undefined && {
          passingPercentage: input.passingPercentage,
        }),
        ...(input.opensAt !== undefined && { opensAt: input.opensAt }),
        ...(input.closesAt !== undefined && { closesAt: input.closesAt }),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.exam.update({
      where: { id },
      data: { deletedAt: new Date(), status: ExamStatus.ARCHIVED },
    });
  }

  async addSection(
    examId: string,
    input: { title: string; description?: string | undefined; position: number },
  ) {
    await this.get(examId);
    return this.prisma.examSection.create({
      data: {
        examId,
        title: input.title,
        description: input.description ?? null,
        position: input.position,
      },
    });
  }

  async addQuestion(
    sectionId: string,
    input: {
      type: QuestionType;
      prompt: string;
      position: number;
      points: number;
      correctText?: string | undefined;
      explanation?: string | undefined;
      choices?: { label: string; position: number; isCorrect?: boolean | undefined }[] | undefined;
    },
  ) {
    const section = await this.prisma.examSection.findUnique({ where: { id: sectionId } });
    if (!section) throw new AppError(404, 'Exam section not found', 'SECTION_NOT_FOUND');
    return this.prisma.examQuestion.create({
      data: {
        sectionId,
        type: input.type,
        prompt: input.prompt,
        position: input.position,
        points: input.points,
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

  async start(userId: string, examId: string) {
    const exam = await this.get(examId, false);
    if (exam.status !== ExamStatus.PUBLISHED)
      throw new AppError(409, 'Exam is not available', 'EXAM_UNAVAILABLE');
    const now = new Date();
    if (exam.opensAt && exam.opensAt > now)
      throw new AppError(409, 'Exam has not opened yet', 'EXAM_NOT_OPEN');
    if (exam.closesAt && exam.closesAt <= now)
      throw new AppError(409, 'Exam is closed', 'EXAM_CLOSED');
    const student = await this.studentForUser(userId);
    await this.requireEnrollment(student.id, exam.courseId);
    const attemptCount = await this.prisma.examAttempt.count({
      where: { examId, studentId: student.id },
    });
    if (attemptCount >= exam.maxAttempts)
      throw new AppError(409, 'Maximum attempts reached', 'MAX_ATTEMPTS_REACHED');
    const expiresAt = exam.durationMinutes
      ? new Date(now.getTime() + exam.durationMinutes * 60_000)
      : null;
    const attempt = await this.prisma.examAttempt.create({
      data: { examId, studentId: student.id, attemptNo: attemptCount + 1, expiresAt },
    });
    return { attempt, exam };
  }

  async submit(
    userId: string,
    attemptId: string,
    submittedAnswers: {
      questionId: string;
      choiceIds?: string[] | undefined;
      textAnswer?: string | undefined;
    }[],
  ) {
    const student = await this.studentForUser(userId);
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: student.id },
      include: {
        exam: { include: { sections: { include: { questions: { include: { choices: true } } } } } },
      },
    });
    if (!attempt) throw new AppError(404, 'Exam attempt not found', 'ATTEMPT_NOT_FOUND');
    if (attempt.status !== ExamAttemptStatus.IN_PROGRESS)
      throw new AppError(409, 'Exam attempt is already closed', 'ATTEMPT_CLOSED');
    const expired = Boolean(attempt.expiresAt && attempt.expiresAt <= new Date());
    const questions = attempt.exam.sections.flatMap((section) => section.questions);
    const answerMap = new Map(submittedAnswers.map((answer) => [answer.questionId, answer]));
    let score = 0;
    const maxScore = questions.reduce((sum, question) => sum + Number(question.points), 0);
    const graded = questions.map((question) => {
      const answer = answerMap.get(question.id);
      let isCorrect = false;
      if (answer) {
        if (
          question.type === QuestionType.SINGLE_CHOICE ||
          question.type === QuestionType.MULTIPLE_CHOICE ||
          question.type === QuestionType.TRUE_FALSE
        ) {
          const expected = question.choices
            .filter((choice) => choice.isCorrect)
            .map((choice) => choice.id)
            .sort();
          const received = [...(answer.choiceIds ?? [])].sort();
          isCorrect =
            expected.length === received.length &&
            expected.every((id, index) => id === received[index]);
        } else if (question.correctText) {
          isCorrect =
            (answer.textAnswer ?? '').trim().toLocaleLowerCase() ===
            question.correctText.trim().toLocaleLowerCase();
        }
      }
      const awardedPoints = isCorrect ? Number(question.points) : 0;
      score += awardedPoints;
      return { question, answer, isCorrect, awardedPoints };
    });
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10_000) / 100 : 0;
    return this.prisma.$transaction(async (tx) => {
      for (const item of graded) {
        const answer = await tx.examAnswer.create({
          data: {
            attemptId,
            questionId: item.question.id,
            textAnswer: item.answer?.textAnswer ?? null,
            awardedPoints: item.awardedPoints,
            isCorrect: item.isCorrect,
          },
        });
        const validChoiceIds = new Set(item.question.choices.map((choice) => choice.id));
        const choiceIds = (item.answer?.choiceIds ?? []).filter((id) => validChoiceIds.has(id));
        if (choiceIds.length)
          await tx.examAnswerChoice.createMany({
            data: choiceIds.map((choiceId) => ({ answerId: answer.id, choiceId })),
          });
      }
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: expired ? ExamAttemptStatus.AUTO_SUBMITTED : ExamAttemptStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });
      return tx.examResult.create({
        data: {
          attemptId,
          score,
          maxScore,
          percentage,
          passed:
            attempt.exam.passingPercentage === null
              ? null
              : percentage >= Number(attempt.exam.passingPercentage),
        },
      });
    });
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }

  private async requireEnrollment(studentId: string, courseId: string) {
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
  }
}
