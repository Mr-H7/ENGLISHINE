import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AuthService, type DeviceContext } from '../services/auth.service.js';
import { AppError } from '../utils/app-error.js';

const registerSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(10).max(128),
  fullName: z.string().trim().min(2).max(160),
  parentPhone: z.string().trim().min(7).max(32).optional(),
});

const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(128),
});

function deviceContext(request: FastifyRequest): DeviceContext {
  const header = request.headers['x-device-id'];
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    deviceId: typeof header === 'string' ? header.slice(0, 120) : undefined,
  };
}

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(env.COOKIE_NAME, token, {
    path: '/api/v1/auth',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    expires: expiresAt,
  });
}

function setAccessCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(env.ACCESS_COOKIE_NAME, token, {
    path: '/api/v1',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.ACCESS_COOKIE_MAX_AGE,
  });
}

function setSessionCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt: Date,
): void {
  setRefreshCookie(reply, refreshToken, refreshExpiresAt);
  setAccessCookie(reply, accessToken);
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(env.COOKIE_NAME, {
    path: '/api/v1/auth',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
  });
  reply.clearCookie(env.ACCESS_COOKIE_NAME, {
    path: '/api/v1',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
  });
}

export async function register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = registerSchema.parse(request.body);
  const result = await new AuthService(request.server.prisma, request.server).signup(
    input,
    deviceContext(request),
  );
  setSessionCookies(reply, result.accessToken, result.refreshToken, result.refreshExpiresAt);
  await reply.code(201).send({ accessToken: result.accessToken, user: result.user });
}

export async function login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = loginSchema.parse(request.body);
  const result = await new AuthService(request.server.prisma, request.server).login(
    input,
    deviceContext(request),
  );
  setSessionCookies(reply, result.accessToken, result.refreshToken, result.refreshExpiresAt);
  await reply.send({ accessToken: result.accessToken, user: result.user });
}

export async function refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawToken = request.cookies[env.COOKIE_NAME];
  if (!rawToken) {
    throw new AppError('Refresh token is required.', {
      statusCode: 401,
      code: 'REFRESH_TOKEN_REQUIRED',
    });
  }

  const result = await new AuthService(request.server.prisma, request.server).refresh(
    rawToken,
    deviceContext(request),
  );
  setSessionCookies(reply, result.accessToken, result.refreshToken, result.refreshExpiresAt);
  await reply.send({ accessToken: result.accessToken, user: result.user });
}

export async function logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await new AuthService(request.server.prisma, request.server).logout(
    request.cookies[env.COOKIE_NAME],
  );
  clearRefreshCookie(reply);
  await reply.code(204).send();
}

export async function me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await new AuthService(request.server.prisma, request.server).getCurrentUser(
    request.user.sub,
  );
  await reply.send({ user });
}
