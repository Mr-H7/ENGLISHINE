import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MultipartFile } from '@fastify/multipart';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import { StorageService } from '../src/services/storage.service.js';
import { LocalStorageDriver } from '../src/services/storage.local.js';
import type { UploadKind } from '../src/services/storage.types.js';
import { HomeworkService } from '../src/services/homework.service.js';
import { ExamService } from '../src/services/exam.service.js';
import { registerStudent } from './register-student.js';

class ImageStorage extends StorageService {
  readonly localDriver = new LocalStorageDriver();
  failedKey: string | null = null;
  override async save(file: MultipartFile, kind: UploadKind) {
    return { ...await this.localDriver.save(file, kind), storageProvider: 'local' };
  }
  override async remove(key: string, provider?: string) {
    if (key === this.failedKey) throw new Error('Isolated cleanup failure');
    assert.equal(provider, 'local');
    await this.localDriver.remove(key);
  }
}
const local = ['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname) && new URL(env.DATABASE_URL).pathname === '/englishine';
void test('private Homework and Exam images preserve authorization, lifecycle and assessment contracts', { skip: !local }, async () => {
  const storage = new ImageStorage();
  const app = await buildApp({ storage }); await app.ready();
  const users: string[] = [], assets: string[] = []; let courseId = '';
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da63fcff1f0002eb01f5697b72670000000049454e44ae426082', 'hex');
  try {
    async function register() {
      const password = crypto.randomUUID();
      const response = await registerStudent(app, { fullName: 'Isolated image QA', password });
      assert.equal(response.statusCode, 201);
      const auth = response.json<{ user: { id: string }; accessToken: string }>(); users.push(auth.user.id);
      const profile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: auth.user.id }, include: { user: true } });
      return { ...auth, profile, password };
    }
    const admin = await register(), learner = await register(), outsider = await register();
    const role = await app.prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } });
    await app.prisma.userRole.create({ data: { userId: admin.user.id, roleId: role.id } });
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: admin.profile.user.phone, password: admin.password }, headers: { 'x-device-id': crypto.randomUUID() } });
    assert.equal(login.statusCode, 200);
    const adminHeaders = { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` };
    const studentHeaders = { authorization: `Bearer ${learner.accessToken}` };
    const course = await app.prisma.course.create({ data: { title: 'Isolated question images', slug: crypto.randomUUID(), createdById: admin.user.id, status: 'PUBLISHED', accessLevel: 'ENROLLED', units: { create: { title: 'Unit', position: 0, status: 'PUBLISHED', accessLevel: 'ENROLLED', lessons: { create: { title: 'Lesson', position: 0, status: 'PUBLISHED', accessLevel: 'ENROLLED' } } } } }, include: { units: { include: { lessons: true } } } });
    courseId = course.id;
    const lessonId = course.units[0]!.lessons[0]!.id;
    const hw = new HomeworkService(app.prisma), examService = new ExamService(app.prisma);
    const homework = await hw.create({ lessonId, title: 'Image homework', passingPercentage: 60 });
    const input = { type: 'SINGLE_CHOICE' as const, prompt: 'Choose', points: 1, position: 0, choices: [{ label: 'A', position: 0, isCorrect: true }, { label: 'B', position: 1 }] };
    const q1 = await hw.addQuestion(homework.id, input);
    const q2 = await hw.addQuestion(homework.id, { ...input, position: 1 });
    assert.equal((await hw.get(homework.id)).questions[0]?.image, null);
    const exam = await examService.create({ courseId, lessonId, title: 'Image exam', passingPercentage: 60 });
    const section = await examService.addSection(exam.id, { title: 'Section', position: 0 });
    const eq = await examService.addQuestion(section.id, input);
    const path = (kind: string, id: string) => `/api/v1/admin/assessment-questions/${kind}/${id}/image`;
    async function upload(kind: string, id: string, bytes = png, mime = 'image/png', headers = adminHeaders) {
      const boundary = `image-${crypto.randomUUID()}`;
      const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="diagram.png"\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const result = await app.inject({ method: 'POST', url: path(kind, id), headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
      if (result.statusCode === 201) {
        const q = kind === 'homework' ? await app.prisma.homeworkQuestion.findUniqueOrThrow({ where: { id } }) : await app.prisma.examQuestion.findUniqueOrThrow({ where: { id } });
        if (q.imageAssetId) assets.push(q.imageAssetId);
      }
      return result;
    }
    assert.equal((await upload('homework', q1.id, png, 'image/png', studentHeaders)).statusCode, 403);
    assert.equal((await upload('homework', q1.id, Buffer.from('<svg></svg>'), 'image/svg+xml')).statusCode, 415);
    assert.equal((await upload('homework', q1.id, Buffer.from('not an image'))).statusCode, 415);
    assert.equal((await upload('homework', q1.id, Buffer.alloc(5 * 1024 * 1024 + 1))).statusCode, 413);
    const first = await upload('homework', q1.id); assert.equal(first.statusCode, 201);
    assert.doesNotMatch(first.body, /storageKey|checksum|originalName|isCorrect|correctText/);
    const oldId = assets[0]!;
    await app.prisma.homeworkQuestion.update({ where: { id: q2.id }, data: { imageAssetId: oldId } });
    assert.equal((await upload('homework', q1.id)).statusCode, 201);
    assert.equal((await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: oldId } })).deletedAt, null);
    assert.equal((await app.inject({ method: 'DELETE', url: path('homework', q2.id), headers: adminHeaders })).statusCode, 204);
    assert.ok((await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: oldId } })).deletedAt);
    const cleanupAsset = await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: assets[1]! } }); storage.failedKey = cleanupAsset.storageKey;
    assert.equal((await upload('homework', q1.id)).statusCode, 201);
    assert.equal((await app.prisma.fileAsset.findUniqueOrThrow({ where: { id: cleanupAsset.id } })).deletedAt, null);
    assert.equal((await upload('exam', eq.id)).statusCode, 201);
    await hw.update(homework.id, { status: 'PUBLISHED' }); await examService.update(exam.id, { status: 'PUBLISHED' });
    await app.prisma.courseEnrollment.create({ data: { courseId, studentId: learner.profile.id, status: 'ACTIVE', source: 'MANUAL' } });
    for (const [kind, id] of [['homework', q1.id], ['exam', eq.id]]) {
      const url = `/api/v1/media/assessment-questions/${kind}/${id}/image`;
      assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
      assert.equal((await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${outsider.accessToken}` } })).statusCode, 403);
      const response = await app.inject({ method: 'GET', url, headers: studentHeaders });
      assert.equal(response.statusCode, 200); assert.equal(response.headers['content-type'], 'image/png'); assert.equal(response.headers['cache-control'], 'private, no-store'); assert.deepEqual(response.rawPayload, png);
      assert.equal((await app.inject({ method: 'GET', url, headers: adminHeaders })).statusCode, 200);
    }
    const detail = await app.inject({ method: 'GET', url: `/api/v1/student/homework/${homework.id}`, headers: studentHeaders });
    assert.equal(detail.statusCode, 200); assert.match(detail.body, /assessment-questions/); assert.doesNotMatch(detail.body, /isCorrect|correctText|imageAssetId|storageKey|checksum/);
    const gate = await app.prisma.progressionRequirement.create({ data: { lessonId, type: 'EXAM_PASSED', targetId: exam.id } });
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/assessment-questions/homework/${q1.id}/image`, headers: studentHeaders })).statusCode, 403);
    await app.prisma.progressionRequirement.delete({ where: { id: gate.id } });
    const attempt = await hw.start(learner.user.id, homework.id);
    assert.equal((await upload('homework', q1.id)).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/homework-questions/${q1.id}`, headers: adminHeaders })).statusCode, 409);
    const result = await hw.submit(learner.user.id, homework.id, [q1, q2].map((q) => ({ questionId: q.id, selectedChoiceId: q.choices.find((c) => c.isCorrect)!.id })), attempt.id);
    assert.equal(result.passed, true); assert.equal(result.attemptNo, 1);
    const examAttempt = await examService.start(learner.user.id, exam.id);
    assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/admin/exam-questions/${eq.id}`, headers: adminHeaders })).statusCode, 409);
    assert.match(JSON.stringify(examAttempt.exam), /assessment-questions/); assert.doesNotMatch(JSON.stringify(examAttempt.exam), /isCorrect|correctText|imageAssetId|storageKey/);
    assert.equal((await app.inject({ method: 'DELETE', url: path('exam', eq.id), headers: adminHeaders })).statusCode, 409);
    assert.equal((await examService.submit(learner.user.id, examAttempt.attempt.id, [{ questionId: eq.id, choiceIds: [eq.choices.find((c) => c.isCorrect)!.id] }])).passed, true);
  } finally {
    storage.failedKey = null;
    if (courseId) {
      await app.prisma.homeworkSubmission.deleteMany({ where: { homework: { lesson: { unit: { courseId } } } } });
      await app.prisma.examAttempt.deleteMany({ where: { exam: { courseId } } });
      await app.prisma.exam.deleteMany({ where: { courseId } });
      await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
      await app.prisma.course.deleteMany({ where: { id: courseId } });
    }
    for (const id of assets) {
      const asset = await app.prisma.fileAsset.findUnique({ where: { id } });
      if (asset) { await storage.remove(asset.storageKey, 'local'); await app.prisma.fileAsset.delete({ where: { id } }); }
    }
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  }
});
