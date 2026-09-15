import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  EnrollmentSource,
  EnrollmentStatus,
  ProgressStatus,
  SystemRole,
} from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { EnrollmentService } from '../services/enrollment.service.js';
import { paginationMeta, paginationSchema, uuidSchema } from '../utils/validation.js';

const staffRoles = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];
const enrollmentSchema = z.object({
  studentId: uuidSchema,
  courseId: uuidSchema,
  status: z.enum(EnrollmentStatus).default(EnrollmentStatus.ACTIVE),
  source: z.enum(EnrollmentSource).default(EnrollmentSource.MANUAL),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const enrollmentRoutes: FastifyPluginAsync = async (app) => {
  const service = new EnrollmentService(app.prisma);

  await app.register(
    (admin, _options, done) => {
      admin.addHook('onRequest', authorize(...staffRoles));
      admin.get('/roles', async () => ({ data: await service.listRoles() }));
      admin.put('/users/:userId/roles', async (request) => {
        const { userId } = z.object({ userId: uuidSchema }).parse(request.params);
        const { roles } = z
          .object({ roles: z.array(z.enum(SystemRole)).min(1) })
          .parse(request.body);
        return { data: await service.assignRoles(request.user.roles, userId, roles) };
      });
      admin.get('/grades', async () => ({ data: await service.listGrades() }));
      admin.get('/students', async (request) => {
        const query = paginationSchema
          .extend({ search: z.string().trim().max(160).optional() })
          .parse(request.query);
        const result = await service.listStudents(query.page, query.pageSize, query.search);
        return { data: result.items, meta: paginationMeta(result.total, query) };
      });
      admin.patch('/students/:studentId/grade', async (request) => {
        const { studentId } = z.object({ studentId: uuidSchema }).parse(request.params);
        const { gradeId } = z.object({ gradeId: uuidSchema.nullable() }).parse(request.body);
        return { data: await service.updateStudentGrade(studentId, gradeId) };
      });
      admin.post('/enrollments', async (request, reply) => {
        const input = enrollmentSchema.parse(request.body);
        const data = await service.enroll(input.studentId, input.courseId, input);
        return reply.code(201).send({ data });
      });
      admin.patch('/enrollments/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        const input = z
          .object({
            status: z.enum(EnrollmentStatus).optional(),
            startsAt: z.coerce.date().nullable().optional(),
            expiresAt: z.coerce.date().nullable().optional(),
          })
          .parse(request.body);
        return { data: await service.updateEnrollment(id, input) };
      });
      done();
    },
    { prefix: '/admin' },
  );

  await app.register(
    (student, _options, done) => {
      student.addHook('onRequest', authenticate);
      student.get('/courses', async (request) => ({
        data: await service.myCourses(request.user.sub),
      }));
      student.get('/courses/:courseId', async (request) => {
        const { courseId } = z.object({ courseId: uuidSchema }).parse(request.params);
        return { data: await service.myCourse(request.user.sub, courseId) };
      });
      student.put('/progress/lessons/:lessonId', async (request) => {
        const { lessonId } = z.object({ lessonId: uuidSchema }).parse(request.params);
        const { status } = z.object({ status: z.enum(ProgressStatus) }).parse(request.body);
        return { data: await service.updateLessonProgress(request.user.sub, lessonId, status) };
      });
      student.put('/progress/videos/:videoId', async (request) => {
        const { videoId } = z.object({ videoId: uuidSchema }).parse(request.params);
        const input = z
          .object({
            watchedSeconds: z.number().int().nonnegative(),
            durationSeconds: z.number().int().positive().optional(),
          })
          .parse(request.body);
        return {
          data: await service.updateVideoProgress(
            request.user.sub,
            videoId,
            input.watchedSeconds,
            input.durationSeconds,
          ),
        };
      });
      done();
    },
    { prefix: '/student' },
  );
};
