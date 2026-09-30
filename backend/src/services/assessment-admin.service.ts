import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { HomeworkService } from './homework.service.js';
import { ExamService } from './exam.service.js';

export type AssessmentKind = 'homework' | 'exam';
export interface ExtractionProvider {
  // No provider is configured. A future adapter must return drafts, never publish.
  extract(assetId: string): Promise<{ questions: unknown[] }>;
}

export class AssessmentAdminService {
  constructor(private readonly prisma: PrismaClient) {}
  async get(kind: AssessmentKind, id: string) {
    const assessment = kind === 'homework' ? await new HomeworkService(this.prisma).get(id) : await new ExamService(this.prisma).get(id);
    const scope = kind === 'homework' ? { homeworkId: id } : { examId: id };
    const [grants, imports] = await Promise.all([
      this.prisma.assessmentAttemptGrant.findMany({ where: scope, orderBy: { createdAt: 'desc' }, include: { student: { select: { id: true, fullName: true } } } }),
      this.prisma.homeworkImportJob.findMany({ where: scope, orderBy: { createdAt: 'desc' }, include: { sourceAsset: { select: { originalName: true } } } }),
    ]);
    const attempts = kind === 'homework'
      ? await this.prisma.homeworkSubmission.findMany({ where: { homeworkId: id }, orderBy: { createdAt: 'desc' }, include: { student: { select: { id: true, fullName: true } }, answers: { include: { question: true } } } })
      : await this.prisma.examAttempt.findMany({ where: { examId: id }, orderBy: { createdAt: 'desc' }, include: { student: { select: { id: true, fullName: true } }, result: true, answers: { include: { question: true } } } });
    return { assessment, attempts, grants, imports };
  }
  async grant(kind: AssessmentKind, id: string, studentId: string, grantedById: string, amount: number) {
    await this.get(kind, id);
    if (![1, 2].includes(amount)) throw new AppError(400, 'اختر محاولة أو محاولتين إضافيتين.', 'INVALID_GRANT');
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw new AppError(404, 'الطالب غير موجود.', 'STUDENT_NOT_FOUND');
    return this.prisma.assessmentAttemptGrant.create({ data: { studentId, grantedById, amount, ...(kind === 'homework' ? { homeworkId: id } : { examId: id }) } });
  }
  async importPdf(kind: AssessmentKind, id: string, sourceAssetId: string, createdById: string) {
    const view = await this.get(kind, id);
    if (view.assessment.status !== 'DRAFT') throw new AppError(409, 'استيراد الأسئلة متاح للمسودات فقط.', 'DRAFT_REQUIRED');
    const asset = await this.prisma.fileAsset.findFirst({ where: { id: sourceAssetId, deletedAt: null, mimeType: 'application/pdf', isPublic: false } });
    if (!asset) throw new AppError(400, 'اختر ملف PDF صالحًا.', 'INVALID_PDF');
    return this.prisma.homeworkImportJob.create({ data: {
      createdById, sourceAssetId, ...(kind === 'homework' ? { homeworkId: id } : { examId: id }),
      status: 'UPLOADED', errorMessage: 'استخراج الأسئلة غير متصل بمزوّد حاليًا. أضف الأسئلة وراجعها يدويًا.',
    } });
  }
  async dependency(kind: AssessmentKind, id: string, target: { lessonId?: string | undefined; unitId?: string | undefined }) {
    const view = await this.get(kind, id);
    const sourceCourseId = 'lesson' in view.assessment ? view.assessment.lesson.unit.courseId : view.assessment.courseId;
    if (Boolean(target.lessonId) === Boolean(target.unitId)) throw new AppError(400, 'اختر درسًا أو وحدة واحدة.', 'INVALID_TARGET');
    const lesson = target.lessonId ? await this.prisma.lesson.findFirst({ where: { id: target.lessonId, deletedAt: null }, include: { unit: true } }) : null;
    const unit = target.unitId ? await this.prisma.courseUnit.findFirst({ where: { id: target.unitId, deletedAt: null } }) : lesson?.unit;
    if (!unit || unit.courseId !== sourceCourseId) throw new AppError(400, 'المحتوى المستهدف يجب أن يتبع نفس الكورس.', 'INVALID_TARGET');
    const sourceLesson = view.assessment.lessonId ? await this.prisma.lesson.findUnique({ where: { id: view.assessment.lessonId }, include: { unit: true } }) : null;
    const sourceUnit = sourceLesson?.unit ?? ('unitId' in view.assessment && view.assessment.unitId ? await this.prisma.courseUnit.findUnique({ where: { id: view.assessment.unitId } }) : null);
    if (sourceUnit && (unit.position < sourceUnit.position || unit.position === sourceUnit.position && (!lesson || !sourceLesson || lesson.position <= sourceLesson.position)))
      throw new AppError(400, 'اختر محتوى لاحقًا للتقييم حتى لا تنشأ متطلبات دائرية.', 'DEPENDENCY_CYCLE');
    if ('lesson' in view.assessment && (target.lessonId === view.assessment.lessonId || target.unitId === view.assessment.lesson.unitId))
      throw new AppError(400, 'لا يمكن قفل محتوى الواجب بنفس الواجب.', 'DEPENDENCY_CYCLE');
    if (!('lesson' in view.assessment) && (view.assessment.lessonId && target.lessonId === view.assessment.lessonId || view.assessment.unitId && target.unitId === view.assessment.unitId))
      throw new AppError(400, 'لا يمكن قفل محتوى الاختبار بنفس الاختبار.', 'DEPENDENCY_CYCLE');
    const type = kind === 'homework' ? 'HOMEWORK_PASSED' : 'EXAM_PASSED';
    const scope = { lessonId: target.lessonId ?? null, unitId: target.unitId ?? null };
    const existing = await this.prisma.progressionRequirement.findFirst({ where: { ...scope, targetId: id, type } });
    return existing ?? this.prisma.progressionRequirement.create({ data: { ...scope, targetId: id, type } });
  }
}
