import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  SystemRole,
} from '../generated/prisma/client.js';
import { authorize } from '../middleware/authorize.js';
import { ContentService } from '../services/content.service.js';
import { paginationMeta, paginationSchema, uuidSchema } from '../utils/validation.js';

const courseSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().trim().max(320).optional(),
  description: z.string().trim().max(20_000).optional(),
  gradeId: uuidSchema.optional(),
  academicTermId: uuidSchema.optional(),
  status: z.enum(CourseStatus).optional(),
  accessLevel: z.enum(AccessLevel).optional(),
});

const unitSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(20_000).optional(),
  academicTermId: uuidSchema.optional(),
  position: z.coerce.number().int().nonnegative(),
  status: z.enum(ContentStatus).optional(),
  availableFrom: z.coerce.date().optional(),
});

const lessonSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(20_000).optional(),
  position: z.coerce.number().int().nonnegative(),
  status: z.enum(ContentStatus).optional(),
  accessLevel: z.enum(AccessLevel).optional(),
  estimatedMinutes: z.coerce.number().int().positive().max(1_440).optional(),
  availableFrom: z.coerce.date().optional(),
});

const staffRoles = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];

export const contentRoutes: FastifyPluginAsync = async (app) => {
  const service = new ContentService(app.prisma);

  await app.register(
    (admin, _options, done) => {
      admin.addHook('onRequest', authorize(...staffRoles));
      admin.get('/courses', async (request) => {
        const query = paginationSchema.parse(request.query);
        const result = await service.listCourses(query.page, query.pageSize);
        return { data: result.items, meta: paginationMeta(result.total, query) };
      });
      admin.post('/courses', async (request, reply) => {
        const course = await service.createCourse(
          courseSchema.parse(request.body),
          request.user.sub,
        );
        return reply.code(201).send({ data: course });
      });
      admin.get('/courses/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.getCourse(id) };
      });
      admin.patch('/courses/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.updateCourse(id, courseSchema.partial().parse(request.body)) };
      });
      admin.delete('/courses/:id', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        await service.deleteCourse(id);
        return reply.code(204).send();
      });
      admin.post('/courses/:courseId/units', async (request, reply) => {
        const { courseId } = z.object({ courseId: uuidSchema }).parse(request.params);
        const unit = await service.createUnit(courseId, unitSchema.parse(request.body));
        return reply.code(201).send({ data: unit });
      });
      admin.patch('/units/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.updateUnit(id, unitSchema.partial().parse(request.body)) };
      });
      admin.delete('/units/:id', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        await service.deleteUnit(id);
        return reply.code(204).send();
      });
      admin.post('/units/:unitId/lessons', async (request, reply) => {
        const { unitId } = z.object({ unitId: uuidSchema }).parse(request.params);
        const lesson = await service.createLesson(unitId, lessonSchema.parse(request.body));
        return reply.code(201).send({ data: lesson });
      });
      admin.get('/lessons/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.getLesson(id) };
      });
      admin.patch('/lessons/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.updateLesson(id, lessonSchema.partial().parse(request.body)) };
      });
      admin.delete('/lessons/:id', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        await service.deleteLesson(id);
        return reply.code(204).send();
      });
      done();
    },
    { prefix: '/admin' },
  );
};
