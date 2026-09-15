import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export const jwtPlugin = fp(
  async (app) => {
    await app.register(jwt, {
      secret: env.JWT_SECRET,
      sign: {
        expiresIn: env.JWT_EXPIRES_IN,
      },
    });
  },
  { name: 'jwt' },
);
