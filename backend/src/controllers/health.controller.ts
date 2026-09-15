import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

export async function getLiveness(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.send({
    status: 'ok',
    service: env.APP_NAME,
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.server.prisma.$queryRaw`SELECT 1`;
    await reply.send({ status: 'ready' });
  } catch (error) {
    request.log.error({ err: error }, 'Database readiness check failed');
    await reply.code(503).send({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection is unavailable.',
      },
    });
  }
}
