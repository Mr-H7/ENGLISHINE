import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient, SystemRole, UserStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/crypto.js';

const input = z
  .object({
    DATABASE_URL: z.string().min(1),
    BOOTSTRAP_ADMIN_EMAIL: z.email().max(320),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(14).max(128),
    BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(160),
  })
  .parse(process.env);

const adapter = new PrismaPg({ connectionString: input.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: SystemRole.SUPER_ADMIN } });
  if (!role) throw new Error('Run the database seed before bootstrapping an administrator.');

  const email = input.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.$transaction([
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
    ]);
    console.info('Existing account granted the Super Admin role; password was not changed.');
    return;
  }

  const passwordHash = await hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
      adminProfile: { create: { fullName: input.BOOTSTRAP_ADMIN_NAME } },
    },
  });
  console.info('Super Admin account created.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
