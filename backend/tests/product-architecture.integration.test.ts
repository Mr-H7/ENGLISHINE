import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  SystemRole,
} from '../src/generated/prisma/client.js';
import { registerStudent } from './register-student.js';

const app = await buildApp();
await app.ready();

const email = `architecture-${crypto.randomUUID()}@example.test`;
const password = 'Englishine-Test-2026!';
let userId = '';
let courseId = '';
const assetIds: string[] = [];
const fixturePaths: string[] = [];
let secondUserId = '';

after(async () => {
  if (courseId) {
    await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
    await app.prisma.activationCodeRedemption.deleteMany({
      where: { activationCode: { OR: [{ unit: { courseId } }, { lesson: { unit: { courseId } } }] } },
    });
    await app.prisma.activationCode.deleteMany({
      where: { OR: [{ unit: { courseId } }, { lesson: { unit: { courseId } } }] },
    });
    await app.prisma.course.deleteMany({ where: { id: courseId } });
  }
  if (assetIds.length) await app.prisma.fileAsset.deleteMany({ where: { id: { in: assetIds } } });
  await Promise.all(fixturePaths.map((path) => rm(path, { force: true })));
  if (userId) await app.prisma.user.deleteMany({ where: { id: userId } });
  if (secondUserId) await app.prisma.user.deleteMany({ where: { id: secondUserId } });
  await app.close();
});

void test('grade personalization and server-side content entitlements', async () => {
  const registration = await registerStudent(app, {
    fullName: 'طالب اختبار هيكل المنتج',
    email,
    password,
  });
  assert.equal(registration.statusCode, 201);
  const auth = registration.json<{ accessToken: string; user: { id: string } }>();
  userId = auth.user.id;
  const headers = { authorization: `Bearer ${auth.accessToken}` };

  const grade = await app.prisma.grade.findUniqueOrThrow({ where: { code: 'PREP_1' } });
  const profileBefore = await app.inject({ method: 'GET', url: '/api/v1/student/profile', headers });
  assert.equal(profileBefore.statusCode, 200);
  assert.equal(profileBefore.json<{ data: { grade: { id: string } } }>().data.grade.id, grade.id);

  const gradeUpdate = await app.inject({
    method: 'PATCH',
    url: '/api/v1/student/profile/grade',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { gradeId: grade.id },
  });
  assert.equal(gradeUpdate.statusCode, 404);

  const course = await app.prisma.course.create({
    data: {
      gradeId: grade.id,
      createdById: userId,
      title: 'اختبار صلاحيات المحتوى',
      slug: `access-test-${crypto.randomUUID()}`,
      status: CourseStatus.PUBLISHED,
      accessLevel: AccessLevel.ENROLLED,
      publishedAt: new Date(),
      units: {
        create: {
          title: 'Unit Test',
          position: 1,
          status: ContentStatus.PUBLISHED,
          lessons: {
            create: [
              {
                title: 'درس مجاني للاختبار',
                position: 1,
                status: ContentStatus.PUBLISHED,
                accessLevel: AccessLevel.FREE,
                videos: {
                  create: {
                    title: 'فيديو مجاني للاختبار',
                    type: 'EXPLANATION',
                    position: 1,
                    status: ContentStatus.PUBLISHED,
                    accessLevel: AccessLevel.FREE,
                  },
                },
              },
              {
                title: 'درس مدفوع للاختبار',
                position: 2,
                status: ContentStatus.PUBLISHED,
                accessLevel: AccessLevel.ENROLLED,
              },
            ],
          },
        },
      },
    },
    include: { units: { include: { lessons: true } } },
  });
  courseId = course.id;
  const [freeLesson, paidLesson] = course.units[0]!.lessons;
  assert.ok(freeLesson && paidLesson);
  const fixtureDirectory = resolve('storage/uploads/tests');
  await mkdir(fixtureDirectory, { recursive: true });
  const videoKey = `tests/${crypto.randomUUID()}.mp4`;
  const resourceKey = `tests/${crypto.randomUUID()}.pdf`;
  const videoPath = resolve('storage/uploads', videoKey);
  const resourcePath = resolve('storage/uploads', resourceKey);
  await writeFile(videoPath, 'englishine-video-access-test');
  await writeFile(resourcePath, '%PDF-1.4 englishine-resource-access-test');
  fixturePaths.push(videoPath, resourcePath);
  const [videoAsset, resourceAsset] = await Promise.all([
    app.prisma.fileAsset.create({
      data: {
        storageProvider: 'local',
        storageKey: videoKey,
        originalName: 'access-test.mp4',
        mimeType: 'video/mp4',
        byteSize: 29n,
      },
    }),
    app.prisma.fileAsset.create({
      data: {
        storageProvider: 'local',
        storageKey: resourceKey,
        originalName: 'access-test.pdf',
        mimeType: 'application/pdf',
        byteSize: 39n,
      },
    }),
  ]);
  assetIds.push(videoAsset.id, resourceAsset.id);
  const [paidVideo, paidResource] = await Promise.all([
    app.prisma.video.create({
      data: {
        lessonId: paidLesson.id,
        fileAssetId: videoAsset.id,
        title: 'فيديو مدفوع للاختبار',
        type: 'EXPLANATION',
        status: ContentStatus.PUBLISHED,
        accessLevel: AccessLevel.ENROLLED,
        position: 1,
      },
    }),
    app.prisma.lessonResource.create({
      data: {
        lessonId: paidLesson.id,
        assetId: resourceAsset.id,
        title: 'ملف مدفوع للاختبار',
        type: 'PDF',
      },
    }),
  ]);

  const explore = await app.inject({ method: 'GET', url: '/api/v1/student/explore', headers });
  assert.equal(explore.statusCode, 200);
  assert.ok(explore.json<{ data: Array<{ id: string }> }>().data.some((item) => item.id === course.id));

  const free = await app.inject({ method: 'GET', url: '/api/v1/student/free-content', headers });
  assert.equal(free.statusCode, 200);
  assert.ok(free.json<{ data: Array<{ lesson: { id: string } }> }>().data.some((item) => item.lesson.id === freeLesson.id));

  const freeAccess = await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${freeLesson.id}`, headers });
  assert.equal(freeAccess.statusCode, 200);

  const denied = await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${paidLesson.id}`, headers });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json<{ error: { code: string } }>().error.code, 'ENROLLMENT_REQUIRED');
  const deniedVideo = await app.inject({
    method: 'GET',
    url: `/api/v1/media/videos/${paidVideo.id}`,
    headers,
  });
  assert.equal(deniedVideo.statusCode, 403);
  const deniedResource = await app.inject({
    method: 'GET',
    url: `/api/v1/media/resources/${paidResource.id}`,
    headers,
  });
  assert.equal(deniedResource.statusCode, 403);

  const student = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId } });
  await app.prisma.courseEnrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      status: EnrollmentStatus.ACTIVE,
      source: EnrollmentSource.MANUAL,
      startsAt: new Date(),
    },
  });

  const allowed = await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${paidLesson.id}`, headers });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.json<{ data: { entitled: boolean } }>().data.entitled, true);
  const allowedVideo = await app.inject({
    method: 'GET',
    url: `/api/v1/media/videos/${paidVideo.id}`,
    headers,
  });
  assert.equal(allowedVideo.statusCode, 200);
  const allowedResource = await app.inject({
    method: 'GET',
    url: `/api/v1/media/resources/${paidResource.id}`,
    headers,
  });
  assert.equal(allowedResource.statusCode, 200);

  const secondRegistration = await registerStudent(app, {
    fullName: 'Scoped access student',
    email: `scoped-${crypto.randomUUID()}@example.test`,
    password,
  });
  assert.equal(secondRegistration.statusCode, 201);
  const secondAuth = secondRegistration.json<{ accessToken: string; user: { id: string } }>();
  secondUserId = secondAuth.user.id;
  const secondHeaders = { authorization: `Bearer ${secondAuth.accessToken}` };
  const otherLesson = await app.prisma.lesson.create({
    data: { unitId: course.units[0]!.id, title: 'Other paid lesson', position: 3,
      status: ContentStatus.PUBLISHED, accessLevel: AccessLevel.ENROLLED },
  });
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${paidLesson.id}`, headers: secondHeaders })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/videos/${paidVideo.id}`, headers: secondHeaders })).statusCode, 403);

  const freeKey = `tests/${crypto.randomUUID()}.mp4`;
  const freePath = resolve('storage/uploads', freeKey);
  await writeFile(freePath, 'englishine-explicit-free-video');
  fixturePaths.push(freePath);
  const freeAsset = await app.prisma.fileAsset.create({ data: { storageProvider: 'local',
    storageKey: freeKey, originalName: 'free.mp4', mimeType: 'video/mp4', byteSize: 30n } });
  assetIds.push(freeAsset.id);
  const freeInPaidLesson = await app.prisma.video.create({ data: {
    lessonId: paidLesson.id, fileAssetId: freeAsset.id, title: 'Explicit free video',
    type: 'EXPLANATION', position: 4, status: ContentStatus.PUBLISHED, accessLevel: AccessLevel.FREE,
  } });
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/videos/${freeInPaidLesson.id}`, headers: secondHeaders })).statusCode, 200);

  const adminRole = await app.prisma.role.findUniqueOrThrow({ where: { key: SystemRole.ADMIN } });
  await app.prisma.userRole.create({ data: { userId, roleId: adminRole.id } });
  const lessonCodeResponse = await app.inject({ method: 'POST', url: '/api/v1/admin/activation-codes',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { unlockType: 'LESSON', targetId: paidLesson.id, maxUses: 1 },
  });
  assert.equal(lessonCodeResponse.statusCode, 201);
  const lessonCode = lessonCodeResponse.json<{ data: { id: string; code: string } }>().data;
  const codeRecord = await app.prisma.activationCode.findUniqueOrThrow({ where: { id: lessonCode.id } });
  assert.equal(codeRecord.codeHash, createHash('sha256').update(lessonCode.code).digest('hex'));
  assert.ok(!JSON.stringify(codeRecord).includes(lessonCode.code));
  const redeemLesson = await app.inject({ method: 'POST', url: '/api/v1/student/activation',
    headers: { ...secondHeaders, 'content-type': 'application/json' }, payload: { code: lessonCode.code } });
  assert.equal(redeemLesson.statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${paidLesson.id}`, headers: secondHeaders })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/videos/${paidVideo.id}`, headers: secondHeaders })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${otherLesson.id}`, headers: secondHeaders })).statusCode, 403);
  const activatedLessons = await app.inject({ method: 'GET', url: '/api/v1/student/activations', headers: secondHeaders });
  assert.equal(activatedLessons.statusCode, 200);
  assert.deepEqual(activatedLessons.json<{ data: Array<{ lessons: Array<{ id: string }> }> }>().data[0]?.lessons.map((item) => item.id), [paidLesson.id]);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/activation-codes/${lessonCode.id}`, headers })).statusCode, 409);

  const unitCodeResponse = await app.inject({ method: 'POST', url: '/api/v1/admin/activation-codes',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { unlockType: 'UNIT', targetId: course.units[0]!.id, maxUses: 1 },
  });
  assert.equal(unitCodeResponse.statusCode, 201);
  const unitCode = unitCodeResponse.json<{ data: { id: string; code: string } }>().data;
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/student/activation',
    headers: { ...secondHeaders, 'content-type': 'application/json' }, payload: { code: unitCode.code } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${otherLesson.id}`, headers: secondHeaders })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/student/activation',
    headers: { ...secondHeaders, 'content-type': 'application/json' }, payload: { code: unitCode.code } })).statusCode, 409);

  const homework = await app.inject({ method: 'POST', url: '/api/v1/admin/homework',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { lessonId: otherLesson.id, title: 'Scoped homework', instructions: 'Original instructions', status: 'PUBLISHED' },
  });
  assert.equal(homework.statusCode, 201);
  const homeworkId = homework.json<{ data: { id: string } }>().data.id;
  const homeworkUpdate = await app.inject({ method: 'PATCH', url: `/api/v1/admin/homework/${homeworkId}`,
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { title: 'Edited homework', instructions: 'Edited instructions' },
  });
  assert.equal(homeworkUpdate.statusCode, 200);
  const listedHomework = await app.inject({ method: 'GET', url: '/api/v1/student/homework', headers: secondHeaders });
  assert.equal(listedHomework.statusCode, 200);
  assert.ok(listedHomework.json<{ data: Array<{ id: string; instructions: string }> }>().data.some((item) =>
    item.id === homeworkId && item.instructions === 'Edited instructions'));
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/homework/${homeworkId}`, headers: secondHeaders })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/homework/${homeworkId}`, headers })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/units/${course.units[0]!.id}`, headers })).statusCode, 409);
  const unitEdit = await app.inject({ method: 'PATCH', url: `/api/v1/admin/units/${course.units[0]!.id}`,
    headers: { ...headers, 'content-type': 'application/json' }, payload: { title: 'Edited unit title' } });
  assert.equal(unitEdit.statusCode, 200);
  assert.equal(unitEdit.json<{ data: { id: string; title: string } }>().data.id, course.units[0]!.id);
  const lessonEdit = await app.inject({ method: 'PATCH', url: `/api/v1/admin/lessons/${paidLesson.id}`,
    headers: { ...headers, 'content-type': 'application/json' }, payload: { title: 'Edited lesson title' } });
  assert.equal(lessonEdit.statusCode, 200);
  assert.equal(lessonEdit.json<{ data: { id: string; title: string } }>().data.id, paidLesson.id);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/videos/${paidVideo.id}`, headers })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/resources/${paidResource.id}`, headers })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/lessons/${otherLesson.id}`, headers })).statusCode, 204);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/lessons/${paidLesson.id}`, headers })).statusCode, 409);
  const unusedResponse = await app.inject({ method: 'POST', url: '/api/v1/admin/activation-codes',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { unlockType: 'LESSON', targetId: freeLesson.id, maxUses: 1 } });
  assert.equal(unusedResponse.statusCode, 201);
  const unusedId = unusedResponse.json<{ data: { id: string } }>().data.id;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/activation-codes/${unusedId}`, headers })).statusCode, 204);
});
