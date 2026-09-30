import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { hash } from 'argon2';
import Fastify from 'fastify';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import {
  AccessLevel,
  ContentStatus,
  CourseStatus,
  VideoType,
} from '../src/generated/prisma/client.js';
import { MediaService } from '../src/services/media.service.js';
import { StorageService } from '../src/services/storage.service.js';
import { registerErrorHandlers } from '../src/utils/error-handler.js';

const database = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/englishine') {
  throw new Error('Video position tests require the local Englishine database');
}

class NoopStorage extends StorageService {
  override remove(): Promise<void> {
    return Promise.resolve();
  }
}

const app = await buildApp();
await app.ready();
const media = new MediaService(app.prisma, new NoopStorage());
const owner = await app.prisma.user.create({
  data: { passwordHash: await hash(randomUUID()) },
});
const courses: string[] = [];

after(async () => {
  await app.prisma.course.deleteMany({ where: { id: { in: courses } } });
  await app.prisma.user.delete({ where: { id: owner.id } });
  await app.close();
});

async function lesson() {
  const course = await app.prisma.course.create({
    data: {
      createdById: owner.id,
      title: 'Video position regression',
      slug: `video-position-${randomUUID()}`,
      status: CourseStatus.DRAFT,
      accessLevel: AccessLevel.LOCKED,
      units: {
        create: {
          title: 'Unit',
          position: 0,
          status: ContentStatus.DRAFT,
          lessons: {
            create: {
              title: 'Lesson',
              position: 0,
              status: ContentStatus.DRAFT,
              accessLevel: AccessLevel.LOCKED,
            },
          },
        },
      },
    },
    include: { units: { include: { lessons: true } } },
  });
  courses.push(course.id);
  return course.units[0]!.lessons[0]!.id;
}

function upload() {
  return {
    storageKey: `videos/tests/${randomUUID()}.mp4`,
    originalName: 'lesson.mp4',
    mimeType: 'video/mp4',
    byteSize: 12n,
    checksum: randomUUID(),
    storageProvider: 'local',
  };
}

const draftVideo = {
  title: 'Lesson video',
  type: VideoType.EXPLANATION,
  position: 0,
  status: ContentStatus.DRAFT,
  accessLevel: AccessLevel.LOCKED,
};

void test('first video in an empty lesson uses position zero', async () => {
  const id = await lesson();
  assert.equal((await media.createVideo(id, draftVideo, upload())).position, 0);
});

void test('additional videos ignore a stale frontend count of zero', async () => {
  const id = await lesson();
  await media.createVideo(id, draftVideo, upload());
  assert.equal((await media.createVideo(id, { ...draftVideo, title: 'Second', position: 0 }, upload())).position, 1);
  assert.equal((await media.createVideo(id, { ...draftVideo, title: 'Third', position: 1 }, upload())).position, 2);
});

void test('independent lessons allocate position zero separately', async () => {
  const first = await lesson();
  const second = await lesson();
  assert.equal((await media.createVideo(first, draftVideo, upload())).position, 0);
  assert.equal((await media.createVideo(second, draftVideo, upload())).position, 0);
});

void test('gaps and soft-deleted highest positions are not reused', async () => {
  const id = await lesson();
  const first = await media.createVideo(id, draftVideo, upload());
  const second = await media.createVideo(id, { ...draftVideo, title: 'Second', position: 0 }, upload());
  const third = await media.createVideo(id, { ...draftVideo, title: 'Third', position: 0 }, upload());
  await app.prisma.video.update({ where: { id: second.id }, data: { position: 7 } });
  await media.removeVideo(third.id);
  const next = await media.createVideo(id, { ...draftVideo, title: 'After deletion', position: 1 }, upload());
  assert.equal(next.position, 8);
  const remaining = await app.prisma.video.findMany({ where: { lessonId: id }, orderBy: { position: 'asc' } });
  assert.deepEqual(remaining.map((video) => video.position), [0, 2, 7, 8]);
  assert.equal(remaining.find((video) => video.id === third.id)?.deletedAt instanceof Date, true);
  assert.equal(remaining.find((video) => video.id === first.id)?.deletedAt, null);
});

void test('concurrent video creation assigns distinct lesson positions', async () => {
  const id = await lesson();
  const videos = await Promise.all(
    [0, 1, 2].map((index) =>
      media.createVideo(id, { ...draftVideo, title: `Concurrent ${index}`, position: 0 }, upload()),
    ),
  );
  assert.deepEqual(videos.map((video) => video.position).sort((a, b) => a - b), [0, 1, 2]);
});

void test('reorder collisions preserve records and expose only a safe Arabic API conflict', async () => {
  const id = await lesson();
  const first = await media.createVideo(id, draftVideo, upload());
  const second = await media.createVideo(id, { ...draftVideo, title: 'Second', position: 0 }, upload());
  const http = Fastify({ logger: false });
  registerErrorHandlers(http);
  http.patch('/video', async () => media.updateVideo(second.id, { position: first.position }));
  try {
    const response = await http.inject({ method: 'PATCH', url: '/video' });
    assert.equal(response.statusCode, 409);
    const payload = response.json<{ error: { code: string; message: string } }>();
    assert.equal(payload.error.code, 'CONFLICT');
    assert.match(payload.error.message, /[\u0600-\u06ff]/);
    assert.doesNotMatch(response.body, /Prisma|Video_lessonId_position|constraint|invocation|\.ts|stack|P2002/i);
    assert.equal((await app.prisma.video.findUniqueOrThrow({ where: { id: second.id } })).position, second.position);
  } finally {
    await http.close();
  }
});
