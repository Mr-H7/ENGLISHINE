import {
  HomeworkStatus,
  type QuestionType,
  ReviewStatus,
  SubmissionStatus,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { hasScopedEntitlement } from './content-access.service.js';
import { assessmentTransaction, attemptAllowance, gradeAnswers, summarizeMarks, validateQuestions } from './assessment-engine.js';
import { ProgressionService } from './progression.service.js';
import { withQuestionImage } from './question-image.contract.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

export interface HomeworkInput {
  lessonId: string;
  title: string;
  instructions?: string | undefined;
  status?: HomeworkStatus | undefined;
  maxScore?: number | undefined;
  maxAttempts?: number | undefined;
  passingPercentage?: number | undefined;
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
    if (includeAnswers) return { ...homework, questions: homework.questions.map((question) => withQuestionImage('homework', question)) };
    return {
      ...homework,
      questions: homework.questions.map((question) => ({
        ...withQuestionImage('homework', question),
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
    const enrolled = await hasScopedEntitlement(
      this.prisma, student.id, homework.lesson.unit.courseId, homework.lesson.unitId, homework.lessonId,
    );
    if (!enrolled) throw new AppError(403, 'Homework activation or enrollment is required', 'ENROLLMENT_REQUIRED');
    await new ProgressionService(this.prisma).assertCanAccessLesson(userId, homework.lessonId);
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { homeworkId: id, studentId: student.id }, orderBy: { attemptNo: 'desc' },
      include: { answers: { include: { selectedChoices: true } } },
    });
    const allowance = await attemptAllowance(this.prisma, student.id, { homeworkId: id }, homework.maxAttempts);
    const attemptsUsed = await this.prisma.homeworkSubmission.count({ where: { homeworkId: id, studentId: student.id } });
    return { ...homework, submission, ...allowance, attemptsUsed, remainingAttempts: Math.max(0, allowance.maxAttempts - attemptsUsed) };
  }

  async create(input: HomeworkInput) {
    if (input.status === HomeworkStatus.PUBLISHED)
      throw new AppError(409, 'أضف الأسئلة وراجعها قبل النشر.', 'QUESTIONS_REQUIRED');
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
        maxAttempts: input.maxAttempts ?? 3,
        passingPercentage: input.passingPercentage ?? null,
        dueAt: input.dueAt ?? null,
        solutionVideoId: input.solutionVideoId ?? null,
      },
    });
  }

  async update(id: string, input: InputPatch<HomeworkInput>) {
    await this.get(id);
    if (input.status === 'PUBLISHED')
      validateQuestions(await this.prisma.homeworkQuestion.findMany({ where: { homeworkId: id }, include: { choices: true } }));
    return this.prisma.homework.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.instructions !== undefined && { instructions: input.instructions || null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.maxScore !== undefined && { maxScore: input.maxScore }),
        ...(input.maxAttempts !== undefined && { maxAttempts: input.maxAttempts }),
        ...(input.passingPercentage !== undefined && { passingPercentage: input.passingPercentage }),
        ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
        ...(input.solutionVideoId !== undefined && {
          solutionVideoId: input.solutionVideoId || null,
        }),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    const submissions = await this.prisma.homeworkSubmission.count({ where: { homeworkId: id } });
    if (submissions) {
      throw new AppError(
        409,
        'Homework with student submissions cannot be deleted',
        'HOMEWORK_HAS_SUBMISSIONS',
      );
    }
    await this.prisma.homework.update({
      where: { id },
      data: { deletedAt: new Date(), status: HomeworkStatus.ARCHIVED },
    });
  }

  async updateQuestion(questionId: string, input: InputPatch<QuestionInput>) {
    const question = await this.prisma.homeworkQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new AppError(404, 'Question not found', 'QUESTION_NOT_FOUND');
    if (await this.prisma.homeworkAnswer.count({ where: { questionId } }))
      throw new AppError(409, 'لا يمكن تغيير سؤال له إجابات محفوظة. أنشئ تقييمًا جديدًا.', 'QUESTION_HAS_ANSWERS');
    return assessmentTransaction(this.prisma, async (tx) => {
      if (input.position !== undefined && input.position !== question.position) {
        const occupied = await tx.homeworkQuestion.findUnique({ where: { homeworkId_position: { homeworkId: question.homeworkId, position: input.position } } });
        if (occupied) {
          const minimum = await tx.homeworkQuestion.aggregate({ where: { homeworkId: question.homeworkId }, _min: { position: true } });
          await tx.homeworkQuestion.update({ where: { id: questionId }, data: { position: (minimum._min.position ?? 0) - 1 } });
          await tx.homeworkQuestion.update({ where: { id: occupied.id }, data: { position: question.position } });
        }
      }
      if (input.choices) {
        await tx.homeworkChoice.deleteMany({ where: { questionId } });
      }
      return tx.homeworkQuestion.update({
        where: { id: questionId },
        data: {
          ...(input.type !== undefined && { type: input.type }),
          ...(input.prompt !== undefined && { prompt: input.prompt }),
          ...(input.position !== undefined && { position: input.position }),
          ...(input.points !== undefined && { points: input.points ?? null }),
          ...(input.correctText !== undefined && { correctText: input.correctText ?? null }),
          ...(input.explanation !== undefined && { explanation: input.explanation ?? null }),
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
    });
  }

  async removeQuestion(questionId: string) {
    const question = await this.prisma.homeworkQuestion.findUnique({
      where: { id: questionId },
      include: { answers: { select: { id: true } } },
    });
    if (!question) throw new AppError(404, 'Question not found', 'QUESTION_NOT_FOUND');
    if (question.answers.length) {
      throw new AppError(409, 'Question has student answers and cannot be deleted', 'QUESTION_HAS_ANSWERS');
    }
    await this.prisma.homeworkQuestion.delete({ where: { id: questionId } });
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

  async start(userId: string, homeworkId: string) {
    const homework = await this.getForStudent(userId, homeworkId);
    await new ProgressionService(this.prisma).assertCanAccessLesson(userId, homework.lessonId);
    const student = await this.prisma.studentProfile.findUniqueOrThrow({ where: { userId } });
    validateQuestions(await this.prisma.homeworkQuestion.findMany({ where: { homeworkId }, include: { choices: true } }));
    return assessmentTransaction(this.prisma, async (tx) => {
      const open = await tx.homeworkSubmission.findFirst({ where: { homeworkId, studentId: student.id, status: 'IN_PROGRESS' } });
      if (open) return open;
      const allowance = await attemptAllowance(tx, student.id, { homeworkId }, homework.maxAttempts);
      const used = await tx.homeworkSubmission.count({ where: { homeworkId, studentId: student.id } });
      if (used >= allowance.maxAttempts) throw new AppError(409, 'نفدت المحاولات المتاحة. تواصل مع Englishine.', 'MAX_ATTEMPTS_REACHED');
      return tx.homeworkSubmission.create({ data: { homeworkId, studentId: student.id, attemptNo: used + 1, status: 'IN_PROGRESS' } });
    });
  }

  async submit(userId: string, homeworkId: string, answers: {
    questionId: string; selectedChoiceId?: string | undefined; selectedChoiceIds?: string[] | undefined; textAnswer?: string | undefined;
  }[], attemptId?: string) {
    await this.getForStudent(userId, homeworkId);
    const homework = await this.get(homeworkId);
    await new ProgressionService(this.prisma).assertCanAccessLesson(userId, homework.lessonId);
    const student = await this.prisma.studentProfile.findUniqueOrThrow({ where: { userId } });
    const inputs = answers.map((answer) => {
      if (answer.selectedChoiceId !== undefined && answer.selectedChoiceIds !== undefined)
        throw new AppError(400, 'استخدم اختيارًا واحدًا أو مجموعة اختيارات فقط.', 'INVALID_CHOICES');
      return { questionId: answer.questionId, choiceIds: answer.selectedChoiceIds ?? (answer.selectedChoiceId ? [answer.selectedChoiceId] : []), textAnswer: answer.textAnswer };
    });
    const canonical = await this.prisma.homeworkQuestion.findMany({ where: { homeworkId }, include: { choices: true } });
    validateQuestions(canonical);
    const graded = gradeAnswers(canonical, inputs);
    const enabled = homework.passingPercentage !== null;
    if (enabled && !attemptId) throw new AppError(400, 'ابدأ محاولة قبل تسليم الإجابات.', 'ATTEMPT_REQUIRED');
    const marks = summarizeMarks(graded.map((item) => item.awardedPoints), graded.reduce((sum, item) => sum + Number(item.question.points ?? 0), 0), Number(homework.passingPercentage ?? 60));
    return assessmentTransaction(this.prisma, async (tx) => {
      let attempt = attemptId ? await tx.homeworkSubmission.findFirst({ where: { id: attemptId, homeworkId, studentId: student.id } })
        : await tx.homeworkSubmission.findFirst({ where: { homeworkId, studentId: student.id, status: 'IN_PROGRESS' } });
      if (attemptId && !attempt) throw new AppError(404, 'المحاولة غير متاحة.', 'ATTEMPT_NOT_FOUND');
      if (attempt && attempt.status !== 'IN_PROGRESS') throw new AppError(409, 'تم تسليم هذه المحاولة بالفعل.', 'ATTEMPT_CLOSED');
      if (!attempt) {
        const allowance = await attemptAllowance(tx, student.id, { homeworkId }, homework.maxAttempts);
        const used = await tx.homeworkSubmission.count({ where: { homeworkId, studentId: student.id } });
        if (used >= allowance.maxAttempts) throw new AppError(409, 'نفدت المحاولات المتاحة.', 'MAX_ATTEMPTS_REACHED');
        attempt = await tx.homeworkSubmission.create({ data: { homeworkId, studentId: student.id, attemptNo: used + 1, status: 'IN_PROGRESS' } });
      }
      return tx.homeworkSubmission.update({ where: { id: attempt.id }, data: {
        status: homework.dueAt && homework.dueAt < new Date() ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
        reviewStatus: enabled && marks.passed !== null ? ReviewStatus.REVIEWED : ReviewStatus.PENDING,
        submittedAt: new Date(),
        ...(enabled ? { ...marks, reviewedAt: marks.passed === null ? null : new Date() } : {}),
        answers: { create: graded.filter((item) => enabled || item.answer).map((item) => ({
          questionId: item.question.id,
          selectedChoiceId: ['SINGLE_CHOICE', 'TRUE_FALSE'].includes(item.question.type) ? item.answer?.choiceIds?.[0] ?? null : null,
          textAnswer: item.answer?.textAnswer ?? null,
          awardedPoints: enabled ? item.awardedPoints : item.question.type === 'MULTIPLE_CHOICE' ? item.awardedPoints : null,
          ...(item.question.type === 'MULTIPLE_CHOICE' ? { selectedChoices: { create: (item.answer?.choiceIds ?? []).map((choiceId) => ({ choiceId })) } } : {}),
        })) },
      }, include: { answers: { include: { selectedChoices: true } } } });
    });
  }

  async review(submissionId: string, reviewerId: string, input: {
    score?: number | undefined; feedback?: string | undefined; reviewStatus: ReviewStatus;
    marks?: { answerId: string; points: number }[] | undefined;
  }) {
    return assessmentTransaction(this.prisma, async (tx) => {
      const submission = await tx.homeworkSubmission.findUnique({ where: { id: submissionId }, include: { homework: true, answers: { include: { question: true } } } });
      if (!submission || !submission.submittedAt) throw new AppError(404, 'التسليم غير متاح.', 'SUBMISSION_NOT_FOUND');
      if (submission.reviewStatus === 'REVIEWED') throw new AppError(409, 'تم اعتماد نتيجة هذه المحاولة.', 'ATTEMPT_CLOSED');
      const enabled = submission.homework.passingPercentage !== null;
      const marks = input.marks ?? [];
      if (new Set(marks.map((m) => m.answerId)).size !== marks.length || marks.some((m) => !submission.answers.some((a) => a.id === m.answerId && a.awardedPoints === null && m.points >= 0 && m.points <= Number(a.question.points ?? 0))))
        throw new AppError(400, 'الدرجات لا تخص الإجابات المطلوب مراجعتها أو تتجاوز الدرجة المتاحة.', 'INVALID_MARKS');
      for (const mark of marks) await tx.homeworkAnswer.update({ where: { id: mark.answerId }, data: { awardedPoints: mark.points } });
      const summary = summarizeMarks(submission.answers.map((a) => marks.find((m) => m.answerId === a.id)?.points ?? (a.awardedPoints === null ? null : Number(a.awardedPoints))), Number(submission.maxScore ?? 0), Number(submission.homework.passingPercentage ?? 60));
      if (enabled && input.reviewStatus === 'REVIEWED' && summary.passed === null) throw new AppError(409, 'راجع كل الإجابات اليدوية قبل اعتماد النتيجة.', 'REVIEW_INCOMPLETE');
      return tx.homeworkSubmission.update({ where: { id: submissionId }, data: {
        reviewedById: reviewerId, reviewedAt: new Date(), reviewStatus: input.reviewStatus,
        ...(enabled ? summary : { score: input.score ?? null }), feedback: input.feedback ?? null,
      } });
    });
  }
}
