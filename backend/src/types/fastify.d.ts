import type { PrismaClient, SystemRole } from '../generated/prisma/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      roles: SystemRole[];
      sessionId: string;
    };
    user: {
      sub: string;
      email: string;
      roles: SystemRole[];
      sessionId: string;
    };
  }
}
