import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ExamStatus, QuestionType, SystemRole } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ExamService } from '../services/exam.service.js';
import { uuidSchema } from '../utils/validation.js';

const examSchema = z.object({
  courseId: uuidSchema,
  lessonId: uuidSchema.optional(),
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().max(20_000).optional(),
  status: z.enum(ExamStatus).optional(),
  durationMinutes: z.number().int().positive().max(1_440).optional(),
  maxAttempts: z.number().int().positive().max(100).optional(),
  passingPercentage: z.number().min(0).max(100).optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
});
const questionSchema = z.object({
  type: z.enum(QuestionType),
  prompt: z.string().trim().min(1).max(20_000),
  position: z.number().int().nonnegative(),
  points: z.number().positive().max(1_000_000),
  correctText: z.string().max(20_000).optional(),
  explanation: z.string().max(20_000).optional(),
  choices: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(2_000),
        position: z.number().int().nonnegative(),
        isCorrect: z.boolean().optional(),
      }),
    )
    .optional(),
});
const staffRoles = [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.TEACHER];

export const examRoutes: FastifyPluginAsync = async (app) => {
  const service = new ExamService(app.prisma);
  await app.register(
    (admin, _options, done) => {
      admin.addHook('onRequest', authorize(...staffRoles));
      admin.get('/exams', async (request) => {
        const { courseId } = z.object({ courseId: uuidSchema.optional() }).parse(request.query);
        return { data: await service.list(courseId) };
      });
      admin.post('/exams', async (request, reply) =>
        reply.code(201).send({ data: await service.create(examSchema.parse(request.body)) }),
      );
      admin.get('/exams/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.get(id) };
      });
      admin.patch('/exams/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.update(id, examSchema.partial().parse(request.body)) };
      });
      admin.delete('/exams/:id', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        await service.remove(id);
        return reply.code(204).send();
      });
      admin.post('/exams/:id/sections', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        const input = z
          .object({
            title: z.string().trim().min(1).max(180),
            description: z.string().max(20_000).optional(),
            position: z.number().int().nonnegative(),
          })
          .parse(request.body);
        return reply.code(201).send({ data: await service.addSection(id, input) });
      });
      admin.post('/exam-sections/:sectionId/questions', async (request, reply) => {
        const { sectionId } = z.object({ sectionId: uuidSchema }).parse(request.params);
        return reply
          .code(201)
          .send({ data: await service.addQuestion(sectionId, questionSchema.parse(request.body)) });
      });
      done();
    },
    { prefix: '/admin' },
  );

  app.post('/student/exams/:id/attempts', { onRequest: authenticate }, async (request, reply) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    return reply.code(201).send({ data: await service.start(request.user.sub, id) });
  });
  app.post(
    '/student/exam-attempts/:attemptId/submit',
    { onRequest: authenticate },
    async (request) => {
      const { attemptId } = z.object({ attemptId: uuidSchema }).parse(request.params);
      const { answers } = z
        .object({
          answers: z.array(
            z.object({
              questionId: uuidSchema,
              choiceIds: z.array(uuidSchema).optional(),
              textAnswer: z.string().max(20_000).optional(),
            }),
          ),
        })
        .parse(request.body);
      return { data: await service.submit(request.user.sub, attemptId, answers) };
    },
  );
};
