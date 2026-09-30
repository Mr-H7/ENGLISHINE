import { Readable } from 'node:stream';
import type { FastifyPluginCallback } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { SystemRole } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { QuestionImageService } from '../services/question-image.service.js';
import { AppError } from '../utils/app-error.js';
import { uuidSchema } from '../utils/validation.js';

const params = z.object({ kind: z.enum(['homework', 'exam']), id: uuidSchema });
const types = ['image/png', 'image/jpeg', 'image/webp'];
export const questionImageRoutes: FastifyPluginCallback = (app, _options, done) => {
  const service = new QuestionImageService(app.prisma, app.storage, app.log);
  const staff = authorize(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER);
  app.post('/admin/assessment-questions/:kind/:id/image', { onRequest: staff }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    await service.assertEditable(kind, id);
    const file = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!file || !types.includes(file.mimetype)) throw new AppError(415, 'اختر صورة PNG أو JPEG أو WebP فقط.', 'UNSUPPORTED_FILE_TYPE');
    const bytes = await file.toBuffer();
    const detected = await fileTypeFromBuffer(bytes);
    if (!detected || !types.includes(detected.mime) || detected.mime !== file.mimetype)
      throw new AppError(415, 'ملف الصورة غير صالح أو نوعه لا يطابق محتواه.', 'UNSUPPORTED_FILE_TYPE');
    // Small bounded images only; preserve the existing storage driver's validation and private provider.
    const stream = Object.assign(Readable.from(bytes), { truncated: false }) as MultipartFile['file'];
    const upload = await app.storage.save({ ...file, file: stream }, 'image');
    try { return reply.code(201).send({ data: { image: await service.replace(kind, id, upload) } }); }
    catch (error) {
      const attached = await app.prisma.fileAsset.findUnique({ where: { storageKey: upload.storageKey } });
      if (!attached) await app.storage.remove(upload.storageKey, upload.storageProvider).catch(() => app.log.warn('Unattached question image cleanup deferred'));
      throw error;
    }
  });
  app.delete('/admin/assessment-questions/:kind/:id/image', { onRequest: staff }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    await service.remove(kind, id);
    return reply.code(204).send();
  });
  app.get('/media/assessment-questions/:kind/:id/image', { onRequest: authenticate }, async (request, reply) => {
    const { kind, id } = params.parse(request.params);
    const asset = await service.asset(kind, id, request.user.sub, request.user.roles);
    const file = await app.storage.open(asset.storageKey, { provider: asset.storageProvider });
    return reply.header('content-type', asset.mimeType).header('content-length', file.details.size)
      .header('cache-control', 'private, no-store').header('x-content-type-options', 'nosniff')
      .header('content-disposition', 'inline').send(file.stream);
  });
  done();
};
