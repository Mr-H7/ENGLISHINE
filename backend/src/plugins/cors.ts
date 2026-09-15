import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export const corsPlugin = fp(
  async (app) => {
    const developmentOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];
    const allowedOrigins =
      env.NODE_ENV === 'production'
        ? env.CORS_ORIGINS
        : Array.from(new Set([...env.CORS_ORIGINS, ...developmentOrigins]));
    await app.register(cors, {
      origin: allowedOrigins.includes('*') ? true : allowedOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Id'],
      exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length'],
      maxAge: 86_400,
    });
  },
  { name: 'cors' },
);
