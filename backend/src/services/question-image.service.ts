import type { PrismaClient, SystemRole } from '../generated/prisma/client.js';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assessmentTransaction } from './assessment-engine.js';
import { retireAssetIfUnreferenced } from './asset-lifecycle.service.js';
import { HomeworkService } from './homework.service.js';
import { ExamService } from './exam.service.js';
import type { StorageService, StoredUpload } from './storage.service.js';
import { questionImage, type QuestionOwner } from './question-image.contract.js';

export class QuestionImageService {
  constructor(private readonly prisma: PrismaClient, private readonly storage: StorageService, private readonly logger?: FastifyBaseLogger) {}
  async question(kind: QuestionOwner, id: string) {
    const question = kind === 'homework'
      ? await this.prisma.homeworkQuestion.findFirst({ where: { id, homework: { deletedAt: null } } })
      : await this.prisma.examQuestion.findFirst({ where: { id, section: { exam: { deletedAt: null } } } });
    if (!question) throw new AppError(404, 'السؤال غير متاح.', 'QUESTION_NOT_FOUND');
    return question;
  }
  async assertEditable(kind: QuestionOwner, id: string) {
    await this.question(kind, id);
    // An image is part of the question presented to an attempt. Preserve it once answering begins.
    const attempts = kind === 'homework'
      ? await this.prisma.homeworkSubmission.count({ where: { homework: { questions: { some: { id } } } } })
      : await this.prisma.examAttempt.count({ where: { exam: { sections: { some: { questions: { some: { id } } } } } } });
    if (attempts) throw new AppError(409, 'لا يمكن تغيير صورة سؤال بدأ الطلاب حله. أنشئ تقييمًا جديدًا.', 'QUESTION_HAS_ATTEMPTS');
  }
  async replace(kind: QuestionOwner, id: string, upload: StoredUpload) {
    await this.assertEditable(kind, id);
    const updated = await assessmentTransaction(this.prisma, async (tx) => {
      const question = kind === 'homework' ? await tx.homeworkQuestion.findUniqueOrThrow({ where: { id } }) : await tx.examQuestion.findUniqueOrThrow({ where: { id } });
      const attempts = kind === 'homework' ? await tx.homeworkSubmission.count({ where: { homework: { questions: { some: { id } } } } }) : await tx.examAttempt.count({ where: { exam: { sections: { some: { questions: { some: { id } } } } } } });
      if (attempts) throw new AppError(409, 'بدأ الطلاب حل هذا التقييم؛ لا يمكن تغيير الصورة.', 'QUESTION_HAS_ATTEMPTS');
      const asset = await tx.fileAsset.create({ data: { ...upload, storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER, isPublic: false } });
      if (kind === 'homework') await tx.homeworkQuestion.update({ where: { id }, data: { imageAssetId: asset.id } });
      else await tx.examQuestion.update({ where: { id }, data: { imageAssetId: asset.id } });
      return { oldId: question.imageAssetId, image: questionImage(kind, { id, imageAssetId: asset.id }) };
    });
    await this.retire(updated.oldId);
    return updated.image;
  }
  async remove(kind: QuestionOwner, id: string) {
    await this.assertEditable(kind, id);
    const oldId = await assessmentTransaction(this.prisma, async (tx) => {
      const question = kind === 'homework' ? await tx.homeworkQuestion.findUniqueOrThrow({ where: { id } }) : await tx.examQuestion.findUniqueOrThrow({ where: { id } });
      const attempts = kind === 'homework' ? await tx.homeworkSubmission.count({ where: { homework: { questions: { some: { id } } } } }) : await tx.examAttempt.count({ where: { exam: { sections: { some: { questions: { some: { id } } } } } } });
      if (attempts) throw new AppError(409, 'بدأ الطلاب حل هذا التقييم؛ لا يمكن إزالة الصورة.', 'QUESTION_HAS_ATTEMPTS');
      if (kind === 'homework') await tx.homeworkQuestion.update({ where: { id }, data: { imageAssetId: null } });
      else await tx.examQuestion.update({ where: { id }, data: { imageAssetId: null } });
      return question.imageAssetId;
    });
    await this.retire(oldId);
  }
  private async retire(id: string | null) {
    // Attachment has committed. Cleanup failure must never roll back/delete its replacement.
    if (id) await retireAssetIfUnreferenced(this.prisma, this.storage, id).catch(() => this.logger?.warn({ assetId: id }, 'Question image cleanup deferred; replacement retained'));
  }
  async asset(kind: QuestionOwner, id: string, userId: string, roles: SystemRole[]) {
    const question = await this.question(kind, id);
    if (!roles.some((role) => ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(role))) {
      if ('homeworkId' in question) {
        const published = await this.prisma.homework.findFirst({ where: { id: question.homeworkId, deletedAt: null, status: 'PUBLISHED', lesson: { deletedAt: null, status: 'PUBLISHED', unit: { deletedAt: null, status: 'PUBLISHED', course: { deletedAt: null, status: 'PUBLISHED' } } } } });
        if (!published) throw new AppError(404, 'هذا الواجب غير متاح حاليًا.', 'HOMEWORK_NOT_FOUND');
        await new HomeworkService(this.prisma).getForStudent(userId, question.homeworkId);
      }
      else await new ExamService(this.prisma).assertStudentAccess(userId, question.sectionId);
    }
    const asset = question.imageAssetId ? await this.prisma.fileAsset.findFirst({ where: { id: question.imageAssetId, deletedAt: null, isPublic: false } }) : null;
    if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) throw new AppError(404, 'صورة السؤال غير متاحة.', 'IMAGE_NOT_FOUND');
    return asset;
  }
}
