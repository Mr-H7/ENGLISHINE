import type { FastifyPluginCallback } from 'fastify';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    handler: register,
  });
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: login,
  });
  app.post('/refresh', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: refresh,
  });
  app.post('/logout', logout);
  app.get('/me', { preHandler: authenticate, handler: me });
  done();
};
