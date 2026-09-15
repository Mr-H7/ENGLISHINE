import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export const securityPlugin = fp(
  async (app) => {
    await app.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    });

    await app.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      hook: 'onRequest',
      allowList: (request) =>
        request.method === 'OPTIONS' ||
        (request.method === 'GET' && request.url.startsWith('/api/v1/media/')),
    });
  },
  { name: 'security' },
);
