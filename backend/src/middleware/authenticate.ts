import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserStatus, type SystemRole } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    const cookieToken = request.cookies[env.ACCESS_COOKIE_NAME];
    if (!cookieToken) {
      await reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
      });
      return;
    }
    try {
      request.user = request.server.jwt.verify<{
        sub: string;
        email: string;
        roles: SystemRole[];
        sessionId: string;
      }>(cookieToken);
    } catch {
      await reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
      });
      return;
    }
  }

  const session = await request.server.prisma.deviceSession.findFirst({
    where: {
      id: request.user.sessionId,
      userId: request.user.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    },
    select: { id: true },
  });
  if (!session) {
    await reply.code(401).send({
      error: {
        code: 'SESSION_INVALID',
        message: 'The session is no longer active.',
      },
    });
    return;
  }
}
