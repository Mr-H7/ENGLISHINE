import { env } from './env.js';

const baseLoggerOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'token',
      '*.token',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'passwordHash',
      '*.passwordHash',
      'R2_SECRET_ACCESS_KEY',
      'secretAccessKey',
      '*.secretAccessKey',
      '*.SecretAccessKey',
    ],
    censor: '[REDACTED]',
  },
};

export const loggerOptions =
  env.NODE_ENV === 'development'
    ? {
        ...baseLoggerOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:standard',
          },
        },
      }
    : baseLoggerOptions;
