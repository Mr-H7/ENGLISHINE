import type { PrismaClient, SystemRole } from '../generated/prisma/client.js';
import type { StorageService } from '../services/storage.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    storage: StorageService;
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
