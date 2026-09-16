import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import {
  AccessLevel,
  ContentStatus,
  ResourceType,
  SystemRole,
  VideoType,
} from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { MediaService } from '../services/media.service.js';
import { StorageService } from '../services/storage.service.js';
import { AppError } from '../utils/app-error.js';
import { uuidSchema } from '../utils/validation.js';

const videoQuerySchema = z.object({
  title: z.string().trim().min(2).max(180),
  type: z.enum(VideoType),
  position: z.coerce.number().int().nonnegative(),
  status: z.enum(ContentStatus).default(ContentStatus.DRAFT),
  accessLevel: z.enum(AccessLevel).default(AccessLevel.LOCKED),
  durationSeconds: z.coerce.number().int().positive().optional(),
});

const videoBodySchema = videoQuerySchema.extend({
  durationSeconds: z.number().int().positive().optional(),
});

const resourceQuerySchema = z.object({
  title: z.string().trim().min(2).max(180),
  type: z.enum(ResourceType).default(ResourceType.PDF),
  position: z.coerce.number().int().nonnegative().default(0),
  isDownload: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const staffRoles = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];

export const mediaRoutes: FastifyPluginCallback = (app, _options, done) => {
  const storage = new StorageService();
  const media = new MediaService(app.prisma, storage);

  app.post(
    '/admin/lessons/:lessonId/videos',
    { onRequest: authorize(...staffRoles) },
    async (request, reply) => {
      const { lessonId } = z.object({ lessonId: uuidSchema }).parse(request.params);
      const input = videoQuerySchema.parse(request.query);
      const file = await request.file();
      if (!file) throw new AppError(400, 'A video file is required', 'FILE_REQUIRED');
      const upload = await storage.save(file, 'video');
      try {
        return reply.code(201).send({ data: await media.createVideo(lessonId, input, upload) });
      } catch (error) {
        await storage.remove(upload.storageKey);
        throw error;
      }
    },
  );

  app.post(
    '/admin/lessons/:lessonId/resources',
    { onRequest: authorize(...staffRoles) },
    async (request, reply) => {
      const { lessonId } = z.object({ lessonId: uuidSchema }).parse(request.params);
      const input = resourceQuerySchema.parse(request.query);
      const file = await request.file();
      if (!file) throw new AppError(400, 'A PDF file is required', 'FILE_REQUIRED');
      const upload = await storage.save(file, 'material');
      try {
        return reply.code(201).send({ data: await media.createResource(lessonId, input, upload) });
      } catch (error) {
        await storage.remove(upload.storageKey);
        throw error;
      }
    },
  );

  app.patch('/admin/videos/:id', { onRequest: authorize(...staffRoles) }, async (request) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    return { data: await media.updateVideo(id, videoBodySchema.partial().parse(request.body)) };
  });

  app.delete('/admin/videos/:id', { onRequest: authorize(...staffRoles) }, async (request, reply) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    await media.removeVideo(id);
    return reply.code(204).send();
  });

  app.delete(
    '/admin/resources/:id',
    { onRequest: authorize(...staffRoles) },
    async (request, reply) => {
      const { id } = z.object({ id: uuidSchema }).parse(request.params);
      await media.removeResource(id);
      return reply.code(204).send();
    },
  );

  app.get('/media/videos/:videoId', { onRequest: authenticate }, async (request, reply) => {
    const { videoId } = z.object({ videoId: uuidSchema }).parse(request.params);
    const asset = await media.getVideoAsset(videoId, request.user.sub, request.user.roles);
    const { size } = await storage.stat(asset.storageKey, asset.storageProvider);
    const range = request.headers.range;
    reply.header('accept-ranges', 'bytes').header('content-type', asset.mimeType);
    if (!range) {
      const file = await storage.open(asset.storageKey, { provider: asset.storageProvider });
      return reply.header('content-length', size).send(file.stream);
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) throw new AppError(416, 'Invalid byte range', 'INVALID_RANGE');
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (start < 0 || end < start || end >= size) {
      return reply.code(416).header('content-range', `bytes */${size}`).send();
    }
    const file = await storage.open(asset.storageKey, {
      range: { start, end },
      provider: asset.storageProvider,
    });
    return reply
      .code(206)
      .header('content-range', `bytes ${start}-${end}/${size}`)
      .header('content-length', end - start + 1)
      .send(file.stream);
  });

  app.get('/media/resources/:resourceId', { onRequest: authenticate }, async (request, reply) => {
    const { resourceId } = z.object({ resourceId: uuidSchema }).parse(request.params);
    const asset = await media.getResourceAsset(resourceId, request.user.sub, request.user.roles);
    const file = await storage.open(asset.storageKey, { provider: asset.storageProvider });
    const safeName = asset.originalName.replace(/["\r\n]/g, '_');
    const disposition = asset.mimeType === 'application/pdf' ? 'inline' : 'attachment';
    return reply
      .header('content-type', asset.mimeType)
      .header('content-length', file.details.size)
      .header('content-disposition', `${disposition}; filename="${safeName}"`)
      .send(file.stream);
  });
  done();
};
