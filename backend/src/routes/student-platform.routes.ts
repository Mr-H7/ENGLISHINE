import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { StudentPlatformService } from '../services/student-platform.service.js';
import { uuidSchema } from '../utils/validation.js';

export const studentPlatformRoutes: FastifyPluginAsync = async (app) => {
  const service = new StudentPlatformService(app.prisma);
  app.get('/catalog/grades', async () => ({ data: await service.grades() }));

  await app.register(
    (student, _options, done) => {
      student.addHook('onRequest', authenticate);
      student.get('/grades', async () => ({ data: await service.grades() }));
      student.get('/profile', async (request) => ({
        data: await service.profile(request.user.sub),
      }));
      student.patch('/profile', async (request) => {
        const input = z
          .object({
            fullName: z.string().trim().min(2).max(160).optional(),
            studentPhone: z.string().trim().min(8).max(32).optional(),
            guardianPhone: z.string().trim().min(8).max(32).optional(),
            email: z.email().max(320).nullable().optional(),
          })
          .parse(request.body);
        return { data: await service.updateProfile(request.user.sub, input) };
      });
      student.get('/explore', async (request) => ({
        data: await service.explore(request.user.sub),
      }));
      student.get('/free-content', async (request) => ({
        data: await service.freeContent(request.user.sub),
      }));
      student.get('/homework', async (request) => ({
        data: await service.homework(request.user.sub),
      }));
      student.get('/exams', async (request) => ({
        data: await service.exams(request.user.sub),
      }));
      student.get('/progress', async (request) => ({
        data: await service.progress(request.user.sub),
      }));
      student.get('/courses/:courseId/roadmap', async (request) => {
        const { courseId } = z.object({ courseId: uuidSchema }).parse(request.params);
        return { data: await service.roadmap(request.user.sub, courseId) };
      });
      student.get('/lessons/:lessonId', async (request) => {
        const { lessonId } = z.object({ lessonId: uuidSchema }).parse(request.params);
        return { data: await service.lesson(request.user.sub, lessonId) };
      });
      done();
    },
    { prefix: '/student' },
  );
};
