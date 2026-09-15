import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SystemRole } from '../generated/prisma/client.js';
import { authenticate } from './authenticate.js';

export function authorize(...allowedRoles: SystemRole[]) {
  return async function authorizationGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await authenticate(request, reply);
    if (reply.sent) return;

    const assignedRoles = await request.server.prisma.userRole.findMany({
      where: { userId: request.user.sub },
      select: { role: { select: { key: true } } },
    });
    if (!allowedRoles.some((role) => assignedRoles.some(({ role: item }) => item.key === role))) {
      await reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
    }
  };
}
