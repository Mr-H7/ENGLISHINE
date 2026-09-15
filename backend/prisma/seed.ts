import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SystemRole } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const roles = [
  {
    key: SystemRole.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'System-level administration role.',
  },
  {
    key: SystemRole.ADMIN,
    name: 'Admin',
    description: 'Platform administration role.',
  },
  {
    key: SystemRole.TEACHER,
    name: 'Teacher',
    description: 'Teaching and educational-content role.',
  },
  {
    key: SystemRole.STUDENT,
    name: 'Student',
    description: 'Student learning role.',
  },
] as const;

const settings = [
  {
    key: 'platform.name',
    value: 'Englishine',
    description: 'Public platform name.',
    isPublic: true,
  },
  {
    key: 'platform.defaultLocale',
    value: 'ar-EG',
    description: 'Default application locale.',
    isPublic: true,
  },
  {
    key: 'platform.direction',
    value: 'rtl',
    description: 'Default interface direction.',
    isPublic: true,
  },
] as const;

const academicStages = [
  { code: 'PRIMARY', nameAr: 'المرحلة الابتدائية', nameEn: 'Primary School', sortOrder: 1 },
  { code: 'PREPARATORY', nameAr: 'المرحلة الإعدادية', nameEn: 'Preparatory School', sortOrder: 2 },
  { code: 'SECONDARY', nameAr: 'المرحلة الثانوية', nameEn: 'Secondary School', sortOrder: 3 },
] as const;

const gradeDefinitions = [
  ['PRIMARY', 'PRIMARY_1', 'الصف الأول الابتدائي', 'Primary 1', 1],
  ['PRIMARY', 'PRIMARY_2', 'الصف الثاني الابتدائي', 'Primary 2', 2],
  ['PRIMARY', 'PRIMARY_3', 'الصف الثالث الابتدائي', 'Primary 3', 3],
  ['PRIMARY', 'PRIMARY_4', 'الصف الرابع الابتدائي', 'Primary 4', 4],
  ['PRIMARY', 'PRIMARY_5', 'الصف الخامس الابتدائي', 'Primary 5', 5],
  ['PRIMARY', 'PRIMARY_6', 'الصف السادس الابتدائي', 'Primary 6', 6],
  ['PREPARATORY', 'PREP_1', 'الصف الأول الإعدادي', 'Preparatory 1', 1],
  ['PREPARATORY', 'PREP_2', 'الصف الثاني الإعدادي', 'Preparatory 2', 2],
  ['PREPARATORY', 'PREP_3', 'الصف الثالث الإعدادي', 'Preparatory 3', 3],
  ['SECONDARY', 'SECONDARY_1', 'الصف الأول الثانوي', 'Secondary 1', 1],
  ['SECONDARY', 'SECONDARY_2', 'الصف الثاني الثانوي', 'Secondary 2', 2],
  ['SECONDARY', 'SECONDARY_3', 'الصف الثالث الثانوي', 'Secondary 3', 3],
] as const;

async function main(): Promise<void> {
  await prisma.$transaction(
    roles.map((role) =>
      prisma.role.upsert({
        where: { key: role.key },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        create: {
          ...role,
          isSystem: true,
        },
      }),
    ),
  );

  await prisma.$transaction(
    settings.map((setting) =>
      prisma.setting.upsert({
        where: { key: setting.key },
        update: setting,
        create: setting,
      }),
    ),
  );
}
  for (const stage of academicStages) {
    await prisma.academicStage.upsert({
      where: { code: stage.code },
      update: stage,
      create: stage,
    });
  }

  const stages = await prisma.academicStage.findMany({
    where: { code: { in: academicStages.map((stage) => stage.code) } },
    select: { id: true, code: true },
  });
  const stageIds = new Map(stages.map((stage) => [stage.code, stage.id]));
  for (const [stageCode, code, nameAr, nameEn, sortOrder] of gradeDefinitions) {
    const stageId = stageIds.get(stageCode);
    if (!stageId) throw new Error('Academic stage ' + stageCode + ' was not created.');
    await prisma.grade.upsert({
      where: { code },
      update: { stageId, nameAr, nameEn, sortOrder, isActive: true },
      create: { stageId, code, nameAr, nameEn, sortOrder, isActive: true },
    });
  }

try {
  await main();
  console.info('Seed completed: roles, settings, stages, and grades are ready.');
} finally {
  await prisma.$disconnect();
}
