import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { SystemRole } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ActivationService } from '../services/activation.service.js';
import { uuidSchema } from '../utils/validation.js';

const staffRoles = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];

export const activationRoutes: FastifyPluginCallback = (app, _options, done) => {
  const service = new ActivationService(app.prisma);
  app.get('/admin/activation-codes', { onRequest: authorize(...staffRoles) }, async (request) => {
    const query = z.object({ unitId: uuidSchema.optional(), lessonId: uuidSchema.optional() }).parse(request.query);
    return { data: await service.list(query) };
  });
  app.post('/admin/activation-codes', { onRequest: authorize(...staffRoles) }, async (request, reply) => {
    const input = z.object({
      unlockType: z.enum(['UNIT', 'LESSON']),
      targetId: uuidSchema,
      label: z.string().trim().max(120).optional(),
      maxUses: z.number().int().min(1).max(1000).default(1),
      expiresAt: z.coerce.date().optional(),
      assignedStudentId: uuidSchema.optional(),
    }).parse(request.body);
    return reply.code(201).send({ data: await service.create(input, request.user.sub) });
  });
  app.patch('/admin/activation-codes/:id/disable', { onRequest: authorize(...staffRoles) }, async (request) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    return { data: await service.disable(id) };
  });
  app.delete('/admin/activation-codes/:id', { onRequest: authorize(...staffRoles) }, async (request, reply) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    await service.removeUnused(id);
    return reply.code(204).send();
  });
  app.get('/student/activations', { onRequest: authenticate }, async (request) => {
    return { data: await service.myContent(request.user.sub) };
  });
  app.post('/student/activation', { onRequest: authenticate }, async (request) => {
    const { code } = z.object({ code: z.string().trim().min(8).max(120) }).parse(request.body);
    return { data: await service.redeem(request.user.sub, code) };
  });
  done();
};
