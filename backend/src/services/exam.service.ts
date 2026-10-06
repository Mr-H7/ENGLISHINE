import {
  EnrollmentStatus,
  ExamAttemptStatus,
  ExamStatus,
  type QuestionType,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { EnrollmentService } from './enrollment.service.js';
import { ProgressionService } from './progression.service.js';
import { assessmentTransaction, attemptAllowance, gradeAnswers, summarizeMarks, validateQuestions } from './assessment-engine.js';
import { withQuestionImage } from './question-image.contract.js';

type InputPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

export interface ExamInput {
  courseId: string;
  unitId?: string | undefined;
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

  async assertStudentAccess(userId: string, sectionId: string) {
    const section = await this.prisma.examSection.findUnique({ where: { id: sectionId }, include: { exam: { include: { course: true, unit: true, lesson: { include: { unit: true } } } } } });
    const exam = section?.exam;
    if (!exam || exam.deletedAt || exam.status !== 'PUBLISHED' || exam.course.deletedAt || exam.course.status !== 'PUBLISHED' ||
      exam.unit && (exam.unit.deletedAt || exam.unit.status !== 'PUBLISHED') || exam.lesson && (exam.lesson.deletedAt || exam.lesson.status !== 'PUBLISHED' || exam.lesson.unit.deletedAt || exam.lesson.unit.status !== 'PUBLISHED'))
      throw new AppError(404, 'هذا الاختبار غير متاح حاليًا.', 'EXAM_UNAVAILABLE');
    const now = new Date();
    if (exam.opensAt && exam.opensAt > now || exam.closesAt && exam.closesAt <= now) throw new AppError(403, 'هذا الاختبار غير متاح حاليًا.', 'EXAM_UNAVAILABLE');
    const student = await this.studentForUser(userId);
    await this.requireEnrollment(student.id, exam.courseId, userId, exam);
  }

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
    if (includeAnswers) return { ...exam, sections: exam.sections.map((section) => ({ ...section, questions: section.questions.map((question) => withQuestionImage('exam', question)) })) };
    return {
      ...exam,
      sections: exam.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
          ...withQuestionImage('exam', question),
          correctText: undefined,
          explanation: undefined,
          choices: question.choices.map((choice) => ({ ...choice, isCorrect: undefined })),
        })),
      })),
    };
  }

  async create(input: ExamInput) {
    if (input.status === ExamStatus.PUBLISHED)
      throw new AppError(409, 'أضف قسمًا بأسئلة صالحة قبل النشر.', 'QUESTIONS_REQUIRED');
    const course = await this.prisma.course.findFirst({
      where: { id: input.courseId, deletedAt: null },
    });
    if (!course) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
    return this.prisma.exam.create({
      data: {
        courseId: input.courseId,
        unitId: input.unitId ?? null,
        lessonId: input.lessonId ?? null,
        title: input.title,
        instructions: input.instructions ?? null,
        status: input.status ?? ExamStatus.DRAFT,
        durationMinutes: input.durationMinutes ?? null,
        maxAttempts: input.maxAttempts ?? 3,
        passingPercentage: input.passingPercentage ?? null,
        opensAt: input.opensAt ?? null,
        closesAt: input.closesAt ?? null,
        publishedAt: null,
      },
    });
  }

  async update(id: string, input: InputPatch<ExamInput>) {
    const current = await this.get(id);
    if (input.status === 'PUBLISHED') {
      const sections = await this.prisma.examSection.findMany({ where: { examId: id }, select: { id: true, _count: { select: { questions: true } } } });
      if (!sections.length || sections.some((section) => section._count.questions === 0))
        throw new AppError(409, 'أضف سؤالًا صالحًا لكل قسم قبل النشر.', 'QUESTIONS_REQUIRED');
      const questions = await this.prisma.examQuestion.findMany({ where: { section: { examId: id } }, include: { choices: true } });
      validateQuestions(questions);
    }
    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(input.courseId !== undefined && { courseId: input.courseId }),
        ...(input.unitId !== undefined && { unitId: input.unitId || null }),
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
    const [attempts, grants, requirements] = await Promise.all([
      this.prisma.examAttempt.count({ where: { examId: id } }),
      this.prisma.assessmentAttemptGrant.count({ where: { examId: id } }),
      this.prisma.progressionRequirement.count({ where: { targetId: id } }),
    ]);
    if (attempts || grants || requirements) {
      throw new AppError(409, 'Exam has student attempts, grants or progression dependencies', 'EXAM_HAS_DEPENDENCIES');
    }
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

  async updateQuestion(id: string, input: { type?: QuestionType | undefined; prompt?: string | undefined; position?: number | undefined; points?: number | undefined; correctText?: string | undefined; choices?: { label: string; position: number; isCorrect?: boolean | undefined }[] | undefined }) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!question) throw new AppError(404, 'السؤال غير موجود.', 'QUESTION_NOT_FOUND');
    if (await this.prisma.examAnswer.count({ where: { questionId: id } })) throw new AppError(409, 'لا يمكن تغيير سؤال له إجابات محفوظة.', 'QUESTION_HAS_ANSWERS');
    return assessmentTransaction(this.prisma, async (tx) => {
      if (input.position !== undefined && input.position !== question.position) {
        const occupied = await tx.examQuestion.findUnique({ where: { sectionId_position: { sectionId: question.sectionId, position: input.position } } });
        if (occupied) {
          const minimum = await tx.examQuestion.aggregate({ where: { sectionId: question.sectionId }, _min: { position: true } });
          await tx.examQuestion.update({ where: { id }, data: { position: (minimum._min.position ?? 0) - 1 } });
          await tx.examQuestion.update({ where: { id: occupied.id }, data: { position: question.position } });
        }
      }
      if (input.choices) await tx.examChoice.deleteMany({ where: { questionId: id } });
      return tx.examQuestion.update({ where: { id }, data: {
        ...(input.type !== undefined && { type: input.type }), ...(input.prompt !== undefined && { prompt: input.prompt }),
        ...(input.position !== undefined && { position: input.position }), ...(input.points !== undefined && { points: input.points }),
        ...(input.correctText !== undefined && { correctText: input.correctText || null }),
        ...(input.choices ? { choices: { create: input.choices.map((c) => ({ ...c, isCorrect: c.isCorrect ?? false })) } } : {}),
      }, include: { choices: true } });
    });
  }
  async removeQuestion(id: string) {
    await assessmentTransaction(this.prisma, async (tx) => {
      const question = await tx.examQuestion.findUnique({ where: { id }, select: { section: { select: { examId: true } } } });
      if (!question) throw new AppError(404, 'السؤال غير موجود.', 'QUESTION_NOT_FOUND');
      if (await tx.examAttempt.count({ where: { examId: question.section.examId } }))
        throw new AppError(409, 'لا يمكن حذف سؤال من اختبار بدأ الطلاب حله.', 'QUESTION_HAS_ATTEMPTS');
      await tx.examQuestion.delete({ where: { id } });
    });
  }

  async start(userId: string, examId: string) {
    const exam = await this.get(examId, false);
    if (!exam.sections.length || exam.sections.some((section) => section.questions.length === 0))
      throw new AppError(409, 'هذا الاختبار بلا أسئلة متاحة. تواصل مع Englishine.', 'QUESTIONS_REQUIRED');
    validateQuestions(await this.prisma.examQuestion.findMany({ where: { section: { examId } }, include: { choices: true } }));
    if (exam.status !== ExamStatus.PUBLISHED)
      throw new AppError(409, 'Exam is not available', 'EXAM_UNAVAILABLE');
    const now = new Date();
    if (exam.opensAt && exam.opensAt > now)
      throw new AppError(409, 'Exam has not opened yet', 'EXAM_NOT_OPEN');
    if (exam.closesAt && exam.closesAt <= now)
      throw new AppError(409, 'Exam is closed', 'EXAM_CLOSED');
    const student = await this.studentForUser(userId);
    await this.requireEnrollment(student.id, exam.courseId, userId, exam);
    return assessmentTransaction(this.prisma, async (tx) => {
    const currentAttempt = await tx.examAttempt.findFirst({
      where: {
        examId, studentId: student.id, status: ExamAttemptStatus.IN_PROGRESS,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { attemptNo: 'desc' },
    });
    if (currentAttempt) return { attempt: currentAttempt, exam };
    const attemptCount = await tx.examAttempt.count({
      where: { examId, studentId: student.id },
    });
    const allowance = await attemptAllowance(tx, student.id, { examId }, exam.maxAttempts);
    if (attemptCount >= allowance.maxAttempts)
      throw new AppError(409, 'نفدت المحاولات المتاحة. تواصل مع Englishine.', 'MAX_ATTEMPTS_REACHED');
    const expiresAt = exam.durationMinutes
      ? new Date(now.getTime() + exam.durationMinutes * 60_000)
      : null;
    const attempt = await tx.examAttempt.create({
      data: { examId, studentId: student.id, attemptNo: attemptCount + 1, expiresAt },
    });
    return { attempt, exam };
    });
  }

  async submit(userId: string, attemptId: string, submittedAnswers: {
    questionId: string; choiceIds?: string[] | undefined; textAnswer?: string | undefined;
  }[]) {
    const student = await this.studentForUser(userId);
    return assessmentTransaction(this.prisma, async (tx) => {
      const attempt = await tx.examAttempt.findFirst({ where: { id: attemptId, studentId: student.id }, include: {
        exam: { include: { sections: { include: { questions: { include: { choices: true } } } } } },
      } });
      if (!attempt) throw new AppError(404, 'المحاولة غير متاحة.', 'ATTEMPT_NOT_FOUND');
      if (attempt.status !== 'IN_PROGRESS') throw new AppError(409, 'تم تسليم هذه المحاولة بالفعل.', 'ATTEMPT_CLOSED');
      await this.requireEnrollment(student.id, attempt.exam.courseId, userId, attempt.exam);
      if (!attempt.exam.sections.length || attempt.exam.sections.some((section) => section.questions.length === 0))
        throw new AppError(409, 'هذا الاختبار بلا أسئلة متاحة. تواصل مع Englishine.', 'QUESTIONS_REQUIRED');
      validateQuestions(attempt.exam.sections.flatMap((section) => section.questions));
      const graded = gradeAnswers(attempt.exam.sections.flatMap((s) => s.questions), submittedAnswers);
      const summary = summarizeMarks(graded.map((g) => g.awardedPoints), graded.reduce((sum, g) => sum + Number(g.question.points), 0), Number(attempt.exam.passingPercentage ?? 60));
      for (const item of graded) await tx.examAnswer.create({ data: {
        attemptId, questionId: item.question.id, textAnswer: item.answer?.textAnswer ?? null,
        awardedPoints: item.awardedPoints, isCorrect: item.isCorrect,
        choices: { create: (item.answer?.choiceIds ?? []).map((choiceId) => ({ choiceId })) },
      } });
      await tx.examAttempt.update({ where: { id: attemptId }, data: {
        status: attempt.expiresAt && attempt.expiresAt <= new Date() ? ExamAttemptStatus.AUTO_SUBMITTED : ExamAttemptStatus.SUBMITTED,
        submittedAt: new Date(),
      } });
      return tx.examResult.create({ data: { attemptId, ...summary,
        ...(attempt.exam.passingPercentage === null ? { passed: null } : {}),
        publishedAt: summary.passed === null ? null : new Date(),
      } });
    });
  }

  async review(attemptId: string, marks: { answerId: string; points: number }[]) {
    return assessmentTransaction(this.prisma, async (tx) => {
      const attempt = await tx.examAttempt.findUnique({ where: { id: attemptId }, include: { result: true, exam: true, answers: { include: { question: true } } } });
      if (!attempt?.result || !attempt.submittedAt) throw new AppError(404, 'المحاولة غير متاحة.', 'ATTEMPT_NOT_FOUND');
      if (attempt.result.publishedAt) throw new AppError(409, 'تم اعتماد النتيجة بالفعل.', 'ATTEMPT_CLOSED');
      if (new Set(marks.map((m) => m.answerId)).size !== marks.length || marks.some((m) => !attempt.answers.some((a) => a.id === m.answerId && a.awardedPoints === null && m.points >= 0 && m.points <= Number(a.question.points))))
        throw new AppError(400, 'درجات المراجعة غير صحيحة.', 'INVALID_MARKS');
      for (const mark of marks) await tx.examAnswer.update({ where: { id: mark.answerId }, data: { awardedPoints: mark.points } });
      const summary = summarizeMarks(attempt.answers.map((a) => marks.find((m) => m.answerId === a.id)?.points ?? (a.awardedPoints === null ? null : Number(a.awardedPoints))), Number(attempt.result.maxScore), Number(attempt.exam.passingPercentage ?? 60));
      if (summary.passed === null) throw new AppError(409, 'راجع كل الإجابات اليدوية أولًا.', 'REVIEW_INCOMPLETE');
      return tx.examResult.update({ where: { attemptId }, data: { ...summary, publishedAt: new Date() } });
    });
  }

  private async studentForUser(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student)
      throw new AppError(403, 'Student profile is required', 'STUDENT_PROFILE_REQUIRED');
    return student;
  }

  private async requireEnrollment(studentId: string, courseId: string, userId: string, exam: { unitId: string | null; lessonId: string | null }) {
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
    if (enrollment) {
      if (exam.lessonId) await new ProgressionService(this.prisma).assertCanAccessLesson(userId, exam.lessonId);
      else if (exam.unitId) {
        const row = (await new ProgressionService(this.prisma).courseRoadmap(studentId, courseId)).find((item) => item.unitId === exam.unitId);
        if (!row || row.state === 'LOCKED') throw new AppError(403, 'أكمل متطلبات الوحدة السابقة أولًا.', 'PROGRESSION_LOCKED');
      }
      return;
    }
    const context = await new EnrollmentService(this.prisma).myCourse(userId, courseId);
    const unit = context?.course.units.find((item) => exam.lessonId
      ? item.lessons.some((lesson) => lesson.id === exam.lessonId)
      : item.id === exam.unitId && context.scope?.unitIds.includes(item.id));
    if (!unit) throw new AppError(403, 'Exam is outside the activated scope', 'ENROLLMENT_REQUIRED');
    const roadmap = await new ProgressionService(this.prisma).courseRoadmap(studentId, courseId);
    const row = roadmap.find((item) => item.unitId === unit.id);
    const state = exam.lessonId ? row?.lessons.find((item) => item.lessonId === exam.lessonId)?.state : row?.state;
    if (!state || state === 'LOCKED') throw new AppError(403, 'Complete the previous learning requirements first', 'PROGRESSION_LOCKED');
  }
}
