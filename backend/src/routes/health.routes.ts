import type { FastifyPluginCallback } from 'fastify';
import { getLiveness, getReadiness } from '../controllers/health.controller.js';

export const healthRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get('/live', getLiveness);
  app.get('/ready', getReadiness);
  done();
};
