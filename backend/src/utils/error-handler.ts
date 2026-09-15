import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from './app-error.js';

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
    const prismaStatus =
      prismaCode === 'P2002' || prismaCode === 'P2003'
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
        : prismaCode === 'P2002'
          ? 'CONFLICT'
          : prismaCode === 'P2003'
            ? 'RELATION_CONFLICT'
            : prismaCode === 'P2025'
              ? 'NOT_FOUND'
              : (error.code ?? 'INTERNAL_SERVER_ERROR');
    const isServerError = statusCode >= 500;

    request.log[isServerError ? 'error' : 'warn']({ err: error }, error.message);

    await reply.code(statusCode).send({
      error: {
        code,
        message:
          isServerError && env.NODE_ENV === 'production' ? 'Internal server error.' : error.message,
        ...(isAppError && error.details !== undefined ? { details: error.details } : {}),
        ...(isValidationError ? { details: error.issues } : {}),
      },
    });
  });
}
