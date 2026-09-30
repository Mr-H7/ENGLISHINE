import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { SystemRole } from '../generated/prisma/client.js';
import { authorize } from '../middleware/authorize.js';
import { AssessmentAdminService } from '../services/assessment-admin.service.js';
import { AppError } from '../utils/app-error.js';
import { uuidSchema } from '../utils/validation.js';
import { env } from '../config/env.js';

const params = z.object({ kind: z.enum(['homework', 'exam']), id: uuidSchema });
export const assessmentRoutes: FastifyPluginCallback = (app, _options, done) => {
  const service = new AssessmentAdminService(app.prisma);
  const staff = authorize(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER);
  app.get('/admin/assessments/:kind/:id', { onRequest: staff }, async (request) => {
    const { kind, id } = params.parse(request.params);
    return { data: await service.get(kind, id) };
  });
  app.post('/admin/assessments/:kind/:id/grants', { onRequest: staff }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    const { studentId, amount } = z.object({ studentId: uuidSchema, amount: z.union([z.literal(1), z.literal(2)]) }).parse(request.body);
    return reply.code(201).send({ data: await service.grant(kind, id, studentId, request.user.sub, amount) });
  });
  app.post('/admin/assessments/:kind/:id/dependencies', { onRequest: staff }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    const target = z.object({ lessonId: uuidSchema.optional(), unitId: uuidSchema.optional() }).parse(request.body);
    return reply.code(201).send({ data: await service.dependency(kind, id, target) });
  });
  app.post('/admin/assessments/:kind/:id/imports', { onRequest: staff }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    // Validate target and draft before saving any object.
    const target = await service.get(kind, id);
    if (target.assessment.status !== 'DRAFT') throw new AppError(409, 'ارفع ملف المصدر إلى مسودة فقط.', 'DRAFT_REQUIRED');
    const file = await request.file();
    if (!file || file.mimetype !== 'application/pdf') throw new AppError(400, 'اختر ملف PDF.', 'INVALID_PDF');
    const upload = await app.storage.save(file, 'material');
    let assetId: string | undefined;
    try {
      const asset = await app.prisma.fileAsset.create({ data: { ...upload, storageProvider: upload.storageProvider ?? env.STORAGE_DRIVER, isPublic: false } });
      assetId = asset.id;
      return reply.code(201).send({ data: await service.importPdf(kind, id, asset.id, request.user.sub) });
    } catch (error) {
      if (assetId) await app.prisma.fileAsset.delete({ where: { id: assetId } });
      await app.storage.remove(upload.storageKey, upload.storageProvider).catch(() => undefined);
      throw error;
    }
  });
  app.get('/admin/assessment-imports/:id/source', { onRequest: staff }, async (request, reply) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    const job = await app.prisma.homeworkImportJob.findUnique({ where: { id }, include: { sourceAsset: true } });
    if (!job || job.sourceAsset.deletedAt) throw new AppError(404, 'ملف المصدر غير متاح.', 'IMPORT_NOT_FOUND');
    const file = await app.storage.open(job.sourceAsset.storageKey, { provider: job.sourceAsset.storageProvider });
    return reply.header('content-type', 'application/pdf').header('content-disposition', 'inline')
      .header('cache-control', 'private, no-store').header('content-length', file.details.size).send(file.stream);
  });
  done();
};
