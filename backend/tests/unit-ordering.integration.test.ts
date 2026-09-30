import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { hash } from 'argon2';
import Fastify from 'fastify';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import { ContentService } from '../src/services/content.service.js';
import { registerErrorHandlers } from '../src/utils/error-handler.js';

const database = new URL(env.DATABASE_URL);
const localHarness =
  ['localhost', '127.0.0.1'].includes(database.hostname) &&
  database.pathname === '/englishine' &&
  env.STORAGE_DRIVER === 'local';
if (!localHarness) {
  void test('unit ordering skipped unless STORAGE_DRIVER=local', { skip: true }, () => {});
} else {
const app = await buildApp();
await app.ready();
const service = new ContentService(app.prisma);
const owner = await app.prisma.user.create({ data: {
  passwordHash: await hash(randomUUID()),
} });
const courses: string[] = [];
after(async () => {
  await app.prisma.course.deleteMany({ where: { id: { in: courses } } });
  await app.prisma.user.delete({ where: { id: owner.id } });
  await app.close();
});
async function course() {
  const result = await service.createCourse({ title: 'Unit ordering regression', slug: `unit-order-${randomUUID()}` }, owner.id);
  courses.push(result.id);
  return result.id;
}

void test('first Unit and independent Courses allocate position zero', async () => {
  const firstCourse = await course();
  const secondCourse = await course();
  assert.equal((await service.createUnit(firstCourse, { title: 'First unit', position: 0 })).position, 0);
  assert.equal((await service.createUnit(secondCourse, { title: 'First unit', position: 0 })).position, 0);
});

void test('stale visible-count position appends after existing one-based Units', async () => {
  const id = await course();
  await app.prisma.courseUnit.createMany({ data: [1, 2].map((position) => ({ courseId: id, title: `Unit ${position}`, position })) });
  assert.equal((await service.createUnit(id, { title: 'New unit', position: 2 })).position, 3);
});

void test('gaps and soft-deleted highest positions are not reused', async () => {
  const id = await course();
  await app.prisma.courseUnit.createMany({ data: [0, 4, 7].map((position) => ({ courseId: id, title: `Unit ${position}`, position })) });
  const highest = await app.prisma.courseUnit.findUniqueOrThrow({ where: { courseId_position: { courseId: id, position: 7 } } });
  await service.deleteUnit(highest.id);
  assert.equal((await service.createUnit(id, { title: 'After deletion', position: 2 })).position, 8);
  const remaining = await app.prisma.courseUnit.findMany({ where: { courseId: id }, orderBy: { position: 'asc' } });
  assert.deepEqual(remaining.map((unit) => unit.position), [0, 4, 7, 8]);
  assert.ok(remaining[2]!.deletedAt);
});

void test('concurrent Unit creation assigns distinct course positions', async () => {
  const id = await course();
  const units = await Promise.all([0, 1, 2].map((index) => service.createUnit(id, { title: `Concurrent ${index}`, position: 0 })));
  assert.deepEqual(units.map((unit) => unit.position).sort((a, b) => a - b), [0, 1, 2]);
});

void test('reorder collisions preserve records and expose only a safe Arabic API conflict', async () => {
  const id = await course();
  const first = await service.createUnit(id, { title: 'First unit', position: 0 });
  const second = await service.createUnit(id, { title: 'Second unit', position: 1 });
  const http = Fastify({ logger: false });
  registerErrorHandlers(http);
  http.patch('/unit', async () => service.updateUnit(second.id, { position: first.position }));
  try {
    const response = await http.inject({ method: 'PATCH', url: '/unit' });
    assert.equal(response.statusCode, 409);
    const payload = response.json<{ error: { code: string; message: string } }>();
    assert.equal(payload.error.code, 'CONFLICT');
    assert.match(payload.error.message, /[\u0600-\u06ff]/);
    assert.doesNotMatch(response.body, /Prisma|CourseUnit|constraint|invocation|\.ts|stack|P2002/i);
    assert.equal((await app.prisma.courseUnit.findUniqueOrThrow({ where: { id: second.id } })).position, second.position);
    await service.updateUnit(second.id, { position: 5 });
    assert.equal((await service.createUnit(id, { title: 'After reorder', position: 2 })).position, 6);
  } finally { await http.close(); }
});
}
