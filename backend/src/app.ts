import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { loggerOptions } from './config/logger.js';
import {
  cookiePlugin,
  corsPlugin,
  jwtPlugin,
  multipartPlugin,
  prismaPlugin,
  securityPlugin,
} from './plugins/index.js';
import { apiRoutes } from './routes/index.js';
import { StorageService } from './services/storage.service.js';
import { registerErrorHandlers } from './utils/error-handler.js';

export async function buildApp(options?: { storage?: StorageService }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: env.TRUST_PROXY,
    bodyLimit: env.BODY_LIMIT_BYTES,
    requestIdHeader: 'x-request-id',
  });

  registerErrorHandlers(app);
  app.setReplySerializer((payload: unknown) =>
    JSON.stringify(payload, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

  await app.register(securityPlugin);
  await app.register(corsPlugin);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(prismaPlugin);
  app.decorate('storage', options?.storage ?? new StorageService());
  await app.register(apiRoutes, { prefix: '/api/v1' });

  return app;
}
