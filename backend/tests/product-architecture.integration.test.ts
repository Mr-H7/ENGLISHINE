import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { buildApp } from '../src/app.js';
import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
} from '../src/generated/prisma/client.js';

const app = await buildApp();
await app.ready();

const email = `architecture-${crypto.randomUUID()}@example.test`;
const password = 'Englishine-Test-2026!';
let userId = '';
let courseId = '';
const assetIds: string[] = [];
const fixturePaths: string[] = [];

after(async () => {
  if (courseId) {
    await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
    await app.prisma.course.deleteMany({ where: { id: courseId } });
  }
  if (assetIds.length) await app.prisma.fileAsset.deleteMany({ where: { id: { in: assetIds } } });
  await Promise.all(fixturePaths.map((path) => rm(path, { force: true })));
  if (userId) await app.prisma.user.deleteMany({ where: { id: userId } });
  await app.close();
});

void test('grade personalization and server-side content entitlements', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: { 'content-type': 'application/json', 'x-device-id': crypto.randomUUID() },
    payload: { fullName: 'طالب اختبار هيكل المنتج', email, password },
  });
  assert.equal(registration.statusCode, 201);
  const auth = registration.json<{ accessToken: string; user: { id: string } }>();
  userId = auth.user.id;
  const headers = { authorization: `Bearer ${auth.accessToken}` };

  const grade = await app.prisma.grade.findUniqueOrThrow({ where: { code: 'PREP_1' } });
  const profileBefore = await app.inject({ method: 'GET', url: '/api/v1/student/profile', headers });
  assert.equal(profileBefore.statusCode, 200);
  assert.equal(profileBefore.json<{ data: { grade: null } }>().data.grade, null);

  const gradeUpdate = await app.inject({
    method: 'PATCH',
    url: '/api/v1/student/profile/grade',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { gradeId: grade.id },
  });
  assert.equal(gradeUpdate.statusCode, 200);
  assert.equal(
    gradeUpdate.json<{ data: { grade: { id: string } } }>().data.grade.id,
    grade.id,
  );

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
});
