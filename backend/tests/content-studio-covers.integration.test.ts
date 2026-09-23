import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import { LocalStorageDriver } from '../src/services/storage.local.js';
import { StorageService } from '../src/services/storage.service.js';
import type { UploadKind } from '../src/services/storage.types.js';
import type { MultipartFile } from '@fastify/multipart';
import { AccessLevel, ContentStatus, CourseStatus, HomeworkStatus, SystemRole } from '../src/generated/prisma/client.js';

class LocalCoverStorage extends StorageService {
  private readonly localDriver = new LocalStorageDriver();
  override async save(file: MultipartFile, kind: UploadKind) {
    const upload = await this.localDriver.save(file, kind);
    return { ...upload, storageProvider: 'local' };
  }
}

const storage = new LocalCoverStorage();
const app = await buildApp({ storage });
await app.ready();
let adminId = '';
let studentId = '';
let courseId = '';
const assetIds: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7cmcAAAAASUVORK5CYII=', 'base64');

async function upload(path: string, token: string) {
  const boundary = `----englishine-${crypto.randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`),
    png, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({ method: 'POST', url: path,
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
}

after(async () => {
  if (courseId) {
    await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
    await app.prisma.course.deleteMany({ where: { id: courseId } });
  }
  for (const id of assetIds) {
    const asset = await app.prisma.fileAsset.findUnique({ where: { id } });
    if (asset) {
      await storage.remove(asset.storageKey, asset.storageProvider).catch(() => undefined);
      await app.prisma.fileAsset.delete({ where: { id } });
    }
  }
  if (adminId) await app.prisma.user.deleteMany({ where: { id: adminId } });
  if (studentId) await app.prisma.user.deleteMany({ where: { id: studentId } });
  await app.close();
});

void test('unit and homework covers upload, replace, protect and remove', async () => {
  async function register(name: string) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/register',
      headers: { 'content-type': 'application/json', 'x-device-id': crypto.randomUUID() },
      payload: { fullName: name, email: `${crypto.randomUUID()}@example.test`, password: 'Englishine-Test-2026!' } });
    assert.equal(response.statusCode, 201);
    return response.json<{ accessToken: string; user: { id: string } }>();
  }
  const admin = await register('Cover admin');
  const student = await register('Cover student');
  adminId = admin.user.id;
  studentId = student.user.id;
  const role = await app.prisma.role.findUniqueOrThrow({ where: { key: SystemRole.ADMIN } });
  await app.prisma.userRole.create({ data: { userId: adminId, roleId: role.id } });
  const course = await app.prisma.course.create({ data: {
    createdById: adminId, title: 'Cover test course', slug: `cover-${crypto.randomUUID()}`,
    status: CourseStatus.PUBLISHED, publishedAt: new Date(), accessLevel: AccessLevel.ENROLLED,
    units: { create: { title: 'Cover test unit', position: 1, status: ContentStatus.PUBLISHED,
      lessons: { create: { title: 'Cover test lesson', position: 1, status: ContentStatus.PUBLISHED,
        homework: { create: { title: 'Cover test homework', status: HomeworkStatus.PUBLISHED } } } } } },
  }, include: { units: { include: { lessons: { include: { homework: true } } } } } });
  courseId = course.id;
  const unitId = course.units[0]!.id;
  const homeworkId = course.units[0]!.lessons[0]!.homework[0]!.id;
  const unitPath = `/api/v1/admin/covers/unit/${unitId}`;
  const homeworkPath = `/api/v1/admin/covers/homework/${homeworkId}`;
  const unitFirst = await upload(unitPath, admin.accessToken);
  assert.equal(unitFirst.statusCode, 201);
  const unitFirstId = unitFirst.json<{ data: { id: string } }>().data.id;
  assetIds.push(unitFirstId);
  const unitSecond = await upload(unitPath, admin.accessToken);
  assert.equal(unitSecond.statusCode, 201);
  const unitSecondId = unitSecond.json<{ data: { id: string } }>().data.id;
  assetIds.push(unitSecondId);
  assert.notEqual(unitFirstId, unitSecondId);
  assert.equal((await app.prisma.courseUnit.findUniqueOrThrow({ where: { id: unitId } })).coverAssetId, unitSecondId);
  assert.ok((await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: unitFirstId } })).deletedAt);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/covers/unit/${unitId}`,
    headers: { authorization: `Bearer ${student.accessToken}` } })).statusCode, 200);

  const homeworkFirst = await upload(homeworkPath, admin.accessToken);
  assert.equal(homeworkFirst.statusCode, 201);
  const homeworkFirstId = homeworkFirst.json<{ data: { id: string } }>().data.id;
  assetIds.push(homeworkFirstId);
  const homeworkSecond = await upload(homeworkPath, admin.accessToken);
  assert.equal(homeworkSecond.statusCode, 201);
  const homeworkSecondId = homeworkSecond.json<{ data: { id: string } }>().data.id;
  assetIds.push(homeworkSecondId);
  assert.equal((await app.prisma.homework.findUniqueOrThrow({ where: { id: homeworkId } })).coverAssetId, homeworkSecondId);
  assert.ok((await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: homeworkFirstId } })).deletedAt);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/covers/homework/${homeworkId}`,
    headers: { authorization: `Bearer ${student.accessToken}` } })).statusCode, 403);
  const studentProfile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: studentId } });
  await app.prisma.courseEnrollment.create({ data: { studentId: studentProfile.id, courseId,
    status: 'ACTIVE', source: 'MANUAL', startsAt: new Date() } });
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/covers/homework/${homeworkId}`,
    headers: { authorization: `Bearer ${student.accessToken}` } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: unitPath,
    headers: { authorization: `Bearer ${admin.accessToken}` } })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: homeworkPath,
    headers: { authorization: `Bearer ${admin.accessToken}` } })).statusCode, 204);
  assert.equal((await app.prisma.courseUnit.findUniqueOrThrow({ where: { id: unitId } })).coverAssetId, null);
  assert.equal((await app.prisma.homework.findUniqueOrThrow({ where: { id: homeworkId } })).coverAssetId, null);
});
