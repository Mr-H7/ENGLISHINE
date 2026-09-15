import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const INSECURE_JWT_SECRETS = new Set([
  'replace-with-a-secure-random-secret-at-least-32-characters',
]);

function isInsecureJwtSecret(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();
  return (
    INSECURE_JWT_SECRETS.has(secret) ||
    normalized.includes('replace-with') ||
    normalized.includes('changeme') ||
    normalized.includes('your-secret')
  );
}

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3_600;
  return amount * 86_400;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().trim().min(1).default('englishine-api'),
    HOST: z.string().trim().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: booleanFromString,
    DATABASE_URL: z.string().trim().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().trim().min(1).default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_NAME: z.string().trim().min(1).default('englishine_refresh'),
    ACCESS_COOKIE_NAME: z.string().trim().min(1).default('englishine_access'),
    COOKIE_SECURE: booleanFromString,
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    CORS_ORIGINS: z.string().trim().min(1).default('http://localhost:5173'),
    BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
    UPLOAD_DIR: z.string().trim().min(1).default('./storage/uploads'),
    UPLOAD_MAX_FILE_BYTES: z.coerce.number().int().positive().default(2_147_483_648),
    MATERIAL_MAX_FILE_BYTES: z.coerce.number().int().positive().default(26_214_400),
    UPLOAD_MAX_FILES: z.coerce.number().int().positive().max(20).default(5),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW: z.string().trim().min(1).default('1 minute'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.CORS_ORIGINS.split(',').includes('*')) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Wildcard CORS origins are not allowed in production.',
      });
    }
    if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'Secure refresh cookies are required in production.',
      });
    }
    if (value.NODE_ENV === 'production' && isInsecureJwtSecret(value.JWT_SECRET)) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'Production JWT_SECRET must be a unique random value, not an example placeholder.',
      });
    }
    if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SAME_SITE'],
        message: 'SameSite=None requires COOKIE_SECURE=true.',
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = z.prettifyError(parsedEnv.error);
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = {
  ...parsedEnv.data,
  CORS_ORIGINS: parsedEnv.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  ACCESS_COOKIE_MAX_AGE: parseDurationSeconds(parsedEnv.data.JWT_EXPIRES_IN),
};

export type Environment = typeof env;
