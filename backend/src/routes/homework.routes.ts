import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HomeworkStatus,
  QuestionType,
  ReviewStatus,
  SystemRole,
} from '../generated/prisma/client.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { HomeworkService } from '../services/homework.service.js';
import { uuidSchema } from '../utils/validation.js';

const homeworkSchema = z.object({
  lessonId: uuidSchema,
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().max(20_000).optional(),
  status: z.enum(HomeworkStatus).optional(),
  maxScore: z.number().nonnegative().max(1_000_000).optional(),
  dueAt: z.coerce.date().optional(),
  solutionVideoId: uuidSchema.optional(),
});
const questionSchema = z.object({
  type: z.enum(QuestionType),
  prompt: z.string().trim().min(1).max(20_000),
  position: z.number().int().nonnegative(),
  points: z.number().nonnegative().optional(),
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

export const homeworkRoutes: FastifyPluginAsync = async (app) => {
  const service = new HomeworkService(app.prisma);
  await app.register(
    (admin, _options, done) => {
      admin.addHook('onRequest', authorize(...staffRoles));
      admin.get('/homework', async (request) => {
        const { lessonId } = z.object({ lessonId: uuidSchema.optional() }).parse(request.query);
        return { data: await service.list(lessonId) };
      });
      admin.post('/homework', async (request, reply) =>
        reply.code(201).send({ data: await service.create(homeworkSchema.parse(request.body)) }),
      );
      admin.get('/homework/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.get(id) };
      });
      admin.patch('/homework/:id', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return { data: await service.update(id, homeworkSchema.partial().parse(request.body)) };
      });
      admin.delete('/homework/:id', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        await service.remove(id);
        return reply.code(204).send();
      });
      admin.post('/homework/:id/questions', async (request, reply) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        return reply
          .code(201)
          .send({ data: await service.addQuestion(id, questionSchema.parse(request.body)) });
      });
      admin.patch('/homework-submissions/:id/review', async (request) => {
        const { id } = z.object({ id: uuidSchema }).parse(request.params);
        const input = z
          .object({
            score: z.number().nonnegative().optional(),
            feedback: z.string().max(20_000).optional(),
            reviewStatus: z.enum(ReviewStatus),
          })
          .parse(request.body);
        return { data: await service.review(id, request.user.sub, input) };
      });
      done();
    },
    { prefix: '/admin' },
  );

  app.get('/student/homework/:id', { onRequest: authenticate }, async (request) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    return { data: await service.getForStudent(request.user.sub, id) };
  });
  app.post(
    '/student/homework/:id/submissions',
    { onRequest: authenticate },
    async (request, reply) => {
      const { id } = z.object({ id: uuidSchema }).parse(request.params);
      const { answers } = z
        .object({
          answers: z.array(
            z.object({
              questionId: uuidSchema,
              selectedChoiceId: uuidSchema.optional(),
              textAnswer: z.string().max(20_000).optional(),
            }),
          ),
        })
        .parse(request.body);
      return reply.code(201).send({ data: await service.submit(request.user.sub, id, answers) });
    },
  );
};
