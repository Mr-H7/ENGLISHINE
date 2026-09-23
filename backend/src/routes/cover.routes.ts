import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { SystemRole } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { CoverService } from '../services/cover.service.js';
import { AppError } from '../utils/app-error.js';
import { uuidSchema } from '../utils/validation.js';

const staff = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];
const targetSchema = z.object({ kind: z.enum(['unit', 'homework']), id: uuidSchema });

export const coverRoutes: FastifyPluginCallback = (app, _options, done) => {
  const service = new CoverService(app.prisma, app.storage);
  app.post('/admin/covers/:kind/:id', { onRequest: authorize(...staff) }, async (request, reply) => {
    const { kind, id } = targetSchema.parse(request.params);
    const file = await request.file();
    if (!file) throw new AppError(400, 'A cover image is required', 'FILE_REQUIRED');
    const upload = await app.storage.save(file, 'image');
    try {
      return reply.code(201).send({ data: await service.replace(kind, id, upload) });
    } catch (error) {
      // Do not delete a file that was already attached if old-asset cleanup failed.
      const attached = await app.prisma.fileAsset.findUnique({ where: { storageKey: upload.storageKey } });
      if (!attached) await app.storage.remove(upload.storageKey, upload.storageProvider).catch(() => undefined);
      throw error;
    }
  });
  app.delete('/admin/covers/:kind/:id', { onRequest: authorize(...staff) }, async (request, reply) => {
    const { kind, id } = targetSchema.parse(request.params);
    await service.remove(kind, id);
    return reply.code(204).send();
  });
  app.get('/media/covers/:kind/:id', { onRequest: authenticate }, async (request, reply) => {
    const { kind, id } = targetSchema.parse(request.params);
    const asset = await service.get(kind, id, request.user.sub, request.user.roles);
    const file = await app.storage.open(asset.storageKey, { provider: asset.storageProvider });
    return reply.header('content-type', asset.mimeType).header('cache-control', 'private, max-age=60')
      .header('content-length', file.details.size).send(file.stream);
  });
  done();
};
