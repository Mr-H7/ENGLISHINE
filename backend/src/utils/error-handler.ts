import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { isRetryableWriteConflict } from './prisma-conflict.js';

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) => {
    await reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} was not found.`,
      },
    });
  });

  app.setErrorHandler(async (error: FastifyError | AppError, request, reply) => {
    const isAppError = error instanceof AppError;
    const isValidationError = error instanceof ZodError;
    const prismaCode = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    const writeConflict = isRetryableWriteConflict(error);
    const prismaStatus =
      writeConflict || prismaCode === 'P2002' || prismaCode === 'P2003' || prismaCode === 'P2034'
        ? 409
        : prismaCode === 'P2025'
          ? 404
          : undefined;
    const statusCode = isAppError
      ? error.statusCode
      : isValidationError
        ? 400
        : (prismaStatus ??
          (typeof error.statusCode === 'number' && error.statusCode >= 400
            ? error.statusCode
            : 500));
    const code = isAppError
      ? error.code
      : isValidationError
        ? 'VALIDATION_ERROR'
        : writeConflict || prismaCode === 'P2002' || prismaCode === 'P2034'
          ? 'CONFLICT'
          : prismaCode === 'P2003'
            ? 'RELATION_CONFLICT'
            : prismaCode === 'P2025'
              ? 'NOT_FOUND'
              : (error.code ?? 'INTERNAL_SERVER_ERROR');
    const isServerError = statusCode >= 500;
    const safeDatabaseMessage =
      writeConflict || prismaCode === 'P2002' || prismaCode === 'P2034'
        ? 'يوجد تعارض مع البيانات الحالية. حدّث الصفحة وحاول مرة أخرى.'
        : prismaCode === 'P2003'
          ? 'لا يمكن إكمال العملية لوجود بيانات مرتبطة.'
          : prismaCode === 'P2025'
            ? 'العنصر المطلوب غير موجود.'
            : undefined;

    request.log[isServerError ? 'error' : 'warn']({ err: error }, error.message);

    await reply.code(statusCode).send({
      error: {
        code,
        message:
          safeDatabaseMessage ?? (isServerError ? 'تعذر إكمال الطلب. حاول مرة أخرى.' : error.message),
        ...(isAppError && error.details !== undefined ? { details: error.details } : {}),
        ...(isValidationError ? { details: error.issues } : {}),
      },
    });
  });
}
