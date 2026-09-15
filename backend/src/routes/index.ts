import type { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { contentRoutes } from './content.routes.js';
import { enrollmentRoutes } from './enrollment.routes.js';
import { examRoutes } from './exam.routes.js';
import { healthRoutes } from './health.routes.js';
import { homeworkRoutes } from './homework.routes.js';
import { mediaRoutes } from './media.routes.js';
import { studentPlatformRoutes } from './student-platform.routes.js';

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(contentRoutes);
  await app.register(enrollmentRoutes);
  await app.register(homeworkRoutes);
  await app.register(examRoutes);
  await app.register(mediaRoutes);
  await app.register(studentPlatformRoutes);
};
