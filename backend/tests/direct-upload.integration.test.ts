import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { Readable } from 'node:stream';
import { env } from '../src/config/env.js';
import { buildApp } from '../src/create-app.js';
import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  SystemRole,
} from '../src/generated/prisma/client.js';
import { AppError } from '../src/utils/app-error.js';
import { StorageService } from '../src/services/storage.service.js';

class FakeDirectStorage extends StorageService {
  readonly objects = new Map<string, { size: number; mimeType: string | null; checksum: string | null }>();

  override supportsDirectUpload(): boolean {
    return true;
  }

  override presignPut(storageKey: string, mimeType: string) {
    return Promise.resolve({
      uploadUrl: `https://r2.example.test/put/${encodeURIComponent(storageKey)}`,
      headers: { 'content-type': mimeType },
      expiresIn: 300,
    });
  }

  override headObject(storageKey: string) {
    const object = this.objects.get(storageKey);
    if (!object) {
      return Promise.reject(new AppError(404, 'Stored object not found', 'STORAGE_OBJECT_NOT_FOUND'));
    }
    return Promise.resolve(object);
  }

  override remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
    return Promise.resolve();
  }
}

const storage = new FakeDirectStorage();
const app = await buildApp({ storage });
await app.ready();

const adminEmail = `direct-admin-${crypto.randomUUID()}@example.test`;
const studentEmail = `direct-student-${crypto.randomUUID()}@example.test`;
const password = 'Englishine-Test-2026!';
const deviceHeaders = {
  'content-type': 'application/json',
  'x-device-id': `test-${crypto.randomUUID()}`,
};

let adminId = '';
let studentId = '';
let lessonId = '';
let courseId = '';
let rangeVideoId = '';
const createdAssetIds: string[] = [];
const fixturePaths: string[] = [];

async function register(email: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: deviceHeaders,
    payload: { fullName: name, email, password },
  });
  assert.equal(response.statusCode, 201);
  return response.json<{ accessToken: string; user: { id: string } }>();
}

const admin = await register(adminEmail, 'مشرف الرفع المباشر');
adminId = admin.user.id;
const student = await register(studentEmail, 'طالب الرفع المباشر');
studentId = student.user.id;
const adminHeaders = { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' };
const studentHeaders = { authorization: `Bearer ${student.accessToken}`, 'content-type': 'application/json' };

const adminRole = await app.prisma.role.findUniqueOrThrow({ where: { key: SystemRole.ADMIN } });
await app.prisma.userRole.create({ data: { userId: adminId, roleId: adminRole.id } });

const grade = await app.prisma.grade.findUniqueOrThrow({ where: { code: 'PREP_1' } });
const course = await app.prisma.course.create({
  data: {
    gradeId: grade.id,
    createdById: adminId,
    title: 'كورس الرفع المباشر',
    slug: `direct-upload-${crypto.randomUUID()}`,
    status: CourseStatus.PUBLISHED,
    accessLevel: AccessLevel.ENROLLED,
    publishedAt: new Date(),
    units: {
      create: {
        title: 'وحدة اختبار',
        position: 1,
        status: ContentStatus.PUBLISHED,
        lessons: {
          create: {
            title: 'درس الرفع المباشر',
            position: 1,
            status: ContentStatus.PUBLISHED,
            accessLevel: AccessLevel.ENROLLED,
          },
        },
      },
    },
  },
  include: { units: { include: { lessons: true } } },
});
courseId = course.id;
lessonId = course.units[0]!.lessons[0]!.id;

const fixtureDirectory = resolve('storage/uploads/tests');
await mkdir(fixtureDirectory, { recursive: true });
const rangeKey = `tests/${crypto.randomUUID()}.mp4`;
const rangePath = resolve('storage/uploads', rangeKey);
await writeFile(rangePath, 'englishine-range-direct-upload');
fixturePaths.push(rangePath);
const rangeAsset = await app.prisma.fileAsset.create({
  data: {
    storageProvider: 'local',
    storageKey: rangeKey,
    originalName: 'range-test.mp4',
    mimeType: 'video/mp4',
    byteSize: BigInt(Buffer.byteLength('englishine-range-direct-upload')),
  },
});
createdAssetIds.push(rangeAsset.id);
const rangeVideo = await app.prisma.video.create({
  data: {
    lessonId,
    fileAssetId: rangeAsset.id,
    title: 'فيديو رينج',
    type: 'EXPLANATION',
    status: ContentStatus.PUBLISHED,
    accessLevel: AccessLevel.ENROLLED,
    position: 99,
  },
});
rangeVideoId = rangeVideo.id;
const studentProfile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: studentId } });
await app.prisma.courseEnrollment.create({
  data: {
    studentId: studentProfile.id,
    courseId,
    status: EnrollmentStatus.ACTIVE,
    source: EnrollmentSource.MANUAL,
    startsAt: new Date(),
  },
});

after(async () => {
  if (courseId) {
    await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
    await app.prisma.course.deleteMany({ where: { id: courseId } });
  }
  if (createdAssetIds.length) {
    await app.prisma.fileAsset.deleteMany({ where: { id: { in: createdAssetIds } } });
  }
  await Promise.all(fixturePaths.map((path) => rm(path, { force: true })));
  if (adminId) await app.prisma.user.deleteMany({ where: { id: adminId } });
  if (studentId) await app.prisma.user.deleteMany({ where: { id: studentId } });
  await app.close();
});

const videoAuthorizePayload = {
  kind: 'video',
  mimeType: 'video/mp4',
  byteSize: 1_048_576,
  originalName: 'lesson.mp4',
  title: 'فيديو رفع مباشر',
  type: 'EXPLANATION',
  position: 0,
  status: 'DRAFT',
  accessLevel: 'LOCKED',
};

void describe('direct-to-R2 upload authorization', { concurrency: 1 }, () => {
  void test('unauthorized request rejected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: { 'content-type': 'application/json' },
      payload: videoAuthorizePayload,
    });
    assert.equal(response.statusCode, 401);
  });

  void test('non-admin rejected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: studentHeaders,
      payload: videoAuthorizePayload,
    });
    assert.equal(response.statusCode, 403);
  });

  void test('invalid MIME rejected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: adminHeaders,
      payload: { ...videoAuthorizePayload, mimeType: 'application/zip' },
    });
    assert.equal(response.statusCode, 415);
    assert.equal(response.json<{ error: { code: string } }>().error.code, 'UNSUPPORTED_FILE_TYPE');
  });

  void test('oversized declared file rejected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: adminHeaders,
      payload: { ...videoAuthorizePayload, byteSize: env.UPLOAD_MAX_FILE_BYTES + 1 },
    });
    assert.equal(response.statusCode, 413);
    assert.equal(response.json<{ error: { code: string } }>().error.code, 'UPLOAD_TOO_LARGE');
  });

  void test('successful authorization', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: adminHeaders,
      payload: videoAuthorizePayload,
    });
    assert.equal(response.statusCode, 201);
    const payload = response.json<{
      data: {
        authorization: string;
        storageKey: string;
        uploadUrl: string;
        headers: Record<string, string>;
        expiresIn: number;
        method: string;
      };
    }>().data;
    assert.equal(payload.method, 'PUT');
    assert.equal(payload.expiresIn, 300);
    assert.match(payload.uploadUrl, /^https:\/\//);
    assert.match(payload.storageKey, /^videos\/\d{4}-\d{2}\/[0-9a-f-]{36}\.mp4$/);
    assert.equal(payload.headers['content-type'], 'video/mp4');
    assert.doesNotMatch(response.body, /R2_SECRET|secretAccessKey/i);
    assert.ok(!payload.uploadUrl.includes(env.JWT_SECRET));
  });
});

void describe('direct-to-R2 upload finalize', { concurrency: 1 }, () => {
  async function authorizeVideo(title = `فيديو ${crypto.randomUUID().slice(0, 8)}`) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/lessons/${lessonId}/uploads/authorize`,
      headers: adminHeaders,
      payload: { ...videoAuthorizePayload, title, position: 1_000 + Math.floor(Math.random() * 50_000) },
    });
    assert.equal(response.statusCode, 201);
    return response.json<{ data: { authorization: string; storageKey: string } }>().data;
  }

  void test('finalize rejects missing object', async () => {
    const session = await authorizeVideo();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/finalize',
      headers: adminHeaders,
      payload: { authorization: session.authorization },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ error: { code: string } }>().error.code, 'UPLOAD_OBJECT_MISSING');
    const asset = await app.prisma.fileAsset.findUnique({ where: { storageKey: session.storageKey } });
    assert.equal(asset, null);
  });

  void test('finalize rejects size mismatch', async () => {
    const session = await authorizeVideo();
    storage.objects.set(session.storageKey, {
      size: videoAuthorizePayload.byteSize + 12,
      mimeType: 'video/mp4',
      checksum: 'etag-size',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/finalize',
      headers: adminHeaders,
      payload: { authorization: session.authorization },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ error: { code: string } }>().error.code, 'UPLOAD_SIZE_MISMATCH');
    const asset = await app.prisma.fileAsset.findUnique({ where: { storageKey: session.storageKey } });
    assert.equal(asset, null);
  });

  void test('finalize rejects type mismatch', async () => {
    const session = await authorizeVideo();
    storage.objects.set(session.storageKey, {
      size: videoAuthorizePayload.byteSize,
      mimeType: 'application/pdf',
      checksum: 'etag-type',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/finalize',
      headers: adminHeaders,
      payload: { authorization: session.authorization },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ error: { code: string } }>().error.code, 'UPLOAD_TYPE_MISMATCH');
    const asset = await app.prisma.fileAsset.findUnique({ where: { storageKey: session.storageKey } });
    assert.equal(asset, null);
  });

  void test('authorization cannot be reused', async () => {
    const session = await authorizeVideo();
    storage.objects.set(session.storageKey, {
      size: videoAuthorizePayload.byteSize,
      mimeType: 'video/mp4',
      checksum: 'etag-ok',
    });
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/finalize',
      headers: adminHeaders,
      payload: { authorization: session.authorization },
    });
    assert.equal(first.statusCode, 201);
    const created = first.json<{ data: { id: string; fileAssetId: string } }>().data;
    createdAssetIds.push(created.fileAssetId);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/uploads/finalize',
      headers: adminHeaders,
      payload: { authorization: session.authorization },
    });
    assert.equal(second.statusCode, 409);
    assert.equal(second.json<{ error: { code: string } }>().error.code, 'UPLOAD_AUTHORIZATION_REUSED');
  });

  void test('existing authenticated Range/206 behavior remains intact', async () => {
    const denied = await app.inject({
      method: 'GET',
      url: `/api/v1/media/videos/${rangeVideoId}`,
      headers: { range: 'bytes=0-5' },
    });
    assert.equal(denied.statusCode, 401);

    const ranged = await app.inject({
      method: 'GET',
      url: `/api/v1/media/videos/${rangeVideoId}`,
      headers: { authorization: studentHeaders.authorization, range: 'bytes=0-5' },
    });
    assert.equal(ranged.statusCode, 206);
    assert.equal(ranged.headers['accept-ranges'], 'bytes');
    assert.match(String(ranged.headers['content-range']), /^bytes 0-5\/\d+$/);
    assert.ok(ranged.rawPayload.length > 0);
    assert.ok(Readable.from(ranged.rawPayload));
  });
});
