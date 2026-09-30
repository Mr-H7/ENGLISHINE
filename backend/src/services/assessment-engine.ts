import { AppError } from '../utils/app-error.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { isRetryableWriteConflict } from '../utils/prisma-conflict.js';

export interface AssessmentQuestion {
  id: string; type: string; points: unknown; correctText: string | null;
  choices: { id: string; isCorrect: boolean }[];
}
export interface AssessmentAnswerInput { questionId: string; choiceIds?: string[] | undefined; textAnswer?: string | undefined }

export function validateQuestions(questions: Array<{ type: string; points: unknown; choices: { isCorrect?: boolean | undefined }[] }>) {
  if (!questions.length) throw new AppError(409, 'أضف الأسئلة وراجعها قبل النشر.', 'QUESTIONS_REQUIRED');
  for (const question of questions) {
    const choiceType = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(question.type);
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (Number(question.points ?? 0) <= 0 || choiceType && (question.choices.length < 2 || correctCount === 0 || question.type !== 'MULTIPLE_CHOICE' && correctCount !== 1 || question.type === 'TRUE_FALSE' && question.choices.length !== 2))
      throw new AppError(409, 'راجع درجات الأسئلة والاختيارات والإجابات الصحيحة قبل النشر.', 'INVALID_QUESTION_CONFIGURATION');
  }
}

// Exact deterministic rules shared by Homework and Exam. LONG_TEXT is NEVER auto-graded.
export function gradeAnswers(questions: AssessmentQuestion[], answers: AssessmentAnswerInput[]) {
  const map = new Map(answers.map((answer) => [answer.questionId, answer]));
  if (map.size !== answers.length || answers.some((answer) => !questions.some((q) => q.id === answer.questionId)))
    throw new AppError(400, 'توجد إجابة لا تخص هذا التقييم أو سؤال مكرر.', 'INVALID_QUESTION');
  return questions.map((question) => {
    const answer = map.get(question.id);
    const ids = answer?.choiceIds ?? [];
    if (new Set(ids).size !== ids.length) throw new AppError(400, 'لا يمكن تكرار الاختيار.', 'DUPLICATE_CHOICES');
    if (ids.some((id) => !question.choices.some((choice) => choice.id === id)))
      throw new AppError(400, 'الاختيار لا يخص هذا السؤال.', 'INVALID_CHOICE');
    const choiceType = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(question.type);
    if ((!choiceType && ids.length) || (question.type !== 'MULTIPLE_CHOICE' && ids.length > 1))
      throw new AppError(400, 'نوع الإجابة غير مناسب للسؤال.', 'INVALID_CHOICES');
    const manual = question.type === 'LONG_TEXT' || question.type === 'SHORT_TEXT' && !question.correctText?.trim();
    const expected = question.choices.filter((choice) => choice.isCorrect).map((choice) => choice.id);
    const normalize = (text: string) => text.normalize('NFC').trim().toLowerCase();
    const correct = choiceType
      ? expected.length > 0 && ids.length === expected.length && expected.every((id) => ids.includes(id))
      : !manual && normalize(answer?.textAnswer ?? '') === normalize(question.correctText ?? '');
    return { question, answer, manual, isCorrect: manual ? null : correct, awardedPoints: manual ? null : correct ? Number(question.points ?? 0) : 0 };
  });
}

export function summarizeMarks(marks: (number | null)[], maxScore: number, passingPercentage: number) {
  const score = marks.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const percentage = maxScore ? Math.round(score / maxScore * 10000) / 100 : 0;
  return { score, maxScore, percentage, passed: marks.some((value) => value === null) ? null : maxScore > 0 && score / maxScore * 100 >= passingPercentage };
}

export async function assessmentTransaction<T>(prisma: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let retry = 0; retry < 4; retry++) {
    try { return await prisma.$transaction(operation, { isolationLevel: 'Serializable' }); }
    catch (error) { if (!isRetryableWriteConflict(error)) throw error; }
  }
  throw new AppError(409, 'تعذر حفظ المحاولة بسبب طلب متزامن. حدّث الصفحة وحاول مرة أخرى.', 'ATTEMPT_CONFLICT');
}

export async function attemptAllowance(tx: Prisma.TransactionClient | PrismaClient, studentId: string, assessment: { homeworkId?: string; examId?: string }, base: number) {
  const grants = await tx.assessmentAttemptGrant.aggregate({ where: { studentId, ...assessment }, _sum: { amount: true } });
  const extraAttempts = grants._sum.amount ?? 0;
  return { baseAttempts: base, extraAttempts, maxAttempts: base + extraAttempts };
}
