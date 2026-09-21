import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient, SystemRole, UserStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/crypto.js';

const CONNECT_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const DISCONNECT_TIMEOUT_MS = 5_000;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BOOTSTRAP_ADMIN_EMAIL: z.email().max(320),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(14).max(128),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(160),
});

function log(message: string): void {
  console.info(`[bootstrap-admin] ${message}`);
}

function redacted(value: string): string {
  return value
    .replaceAll(/postgresql:\/\/[^\s"'`]+/gi, '[redacted-database-url]')
    .replaceAll(/postgres:\/\/[^\s"'`]+/gi, '[redacted-database-url]')
    .replaceAll(/\$argon2[^\s"'`]+/gi, '[redacted-hash]')
    .replaceAll(/(password|secret|token|authorization)=[^\s"'`&]+/gi, '$1=[redacted]');
}

function formatSafeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const record = error as { code?: unknown; name?: unknown };
  const code = typeof record.code === 'string' || typeof record.code === 'number' ? String(record.code) : undefined;
  const name = typeof record.name === 'string' && record.name ? record.name : err.name;
  const parts = [`${name}: ${redacted(err.message)}`];
  if (code) parts.push(`code=${code}`);
  return parts.join(' ');
}

async function withTimeout<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      (error as { code?: string }).code = 'BOOTSTRAP_TIMEOUT';
      reject(error);
    }, ms);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let prisma: PrismaClient | undefined;

async function disconnect(): Promise<void> {
  if (!prisma) {
    log('no prisma client to disconnect');
    return;
  }

  log('disconnecting prisma');
  try {
    await withTimeout('prisma.$disconnect', DISCONNECT_TIMEOUT_MS, prisma.$disconnect());
    log('prisma disconnected');
  } catch (error) {
    console.error(`[bootstrap-admin] disconnect failed: ${formatSafeError(error)}`);
  }
}

async function main(): Promise<void> {
  log('validating environment');
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw parsed.error;
  }
  const input = parsed.data;
  log('environment validated');

  log(`creating postgres adapter (connectionTimeout=${CONNECT_TIMEOUT_MS}ms, queryTimeout=${QUERY_TIMEOUT_MS}ms)`);
  const adapter = new PrismaPg({
    connectionString: input.DATABASE_URL,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });
  log('postgres adapter created');

  log('creating prisma client');
  prisma = new PrismaClient({ adapter });
  log('prisma client created');

  log('querying SUPER_ADMIN role');
  const role = await withTimeout(
    'role.findUnique(SUPER_ADMIN)',
    QUERY_TIMEOUT_MS,
    prisma.role.findUnique({ where: { key: SystemRole.SUPER_ADMIN } }),
  );
  if (!role) throw new Error('Run the database seed before bootstrapping an administrator.');
  log('SUPER_ADMIN role found');

  const email = input.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  log('looking up existing user');
  const existing = await withTimeout(
    'user.findUnique(email)',
    QUERY_TIMEOUT_MS,
    prisma.user.findUnique({ where: { email } }),
  );

  if (existing) {
    log('existing user found; granting Super Admin role without changing password');
    await withTimeout(
      'grant Super Admin transaction',
      QUERY_TIMEOUT_MS,
      prisma.$transaction([
        prisma.userRole.upsert({
          where: { userId_roleId: { userId: existing.id, roleId: role.id } },
          update: {},
          create: { userId: existing.id, roleId: role.id },
        }),
        prisma.adminProfile.upsert({
          where: { userId: existing.id },
          update: { fullName: input.BOOTSTRAP_ADMIN_NAME },
          create: { userId: existing.id, fullName: input.BOOTSTRAP_ADMIN_NAME },
        }),
      ]),
    );
    log('Existing account granted the Super Admin role; password was not changed.');
    return;
  }

  log('no existing user; hashing password');
  const passwordHash = await withTimeout(
    'hashPassword',
    QUERY_TIMEOUT_MS,
    hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD),
  );
  log('password hashed');

  log('creating Super Admin user');
  await withTimeout(
    'user.create(Super Admin)',
    QUERY_TIMEOUT_MS,
    prisma.user.create({
      data: {
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: role.id } },
        adminProfile: { create: { fullName: input.BOOTSTRAP_ADMIN_NAME } },
      },
    }),
  );
  log('Super Admin account created.');
}

let failed = false;
try {
  log('starting');
  await main();
  log('finished');
} catch (error) {
  failed = true;
  console.error(`[bootstrap-admin] failed: ${formatSafeError(error)}`);
  process.exitCode = 1;
} finally {
  await disconnect();
}

process.exit(failed ? 1 : 0);
