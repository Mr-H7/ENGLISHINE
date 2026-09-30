import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import { ProgressionService } from '../src/services/progression.service.js';
import { HomeworkService } from '../src/services/homework.service.js';
import { ExamService } from '../src/services/exam.service.js';
import { registerStudent } from './register-student.js';

if (!['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname) ||
  new URL(env.DATABASE_URL).pathname !== '/englishine' || env.STORAGE_DRIVER !== 'local') {
  void test('release progression requires isolated local database and storage', { skip: true }, () => {});
} else {
  void test('new enrollment cannot gain progress from empty locked units; completed learning still unlocks the next unit', async () => {
    const app = await buildApp();
    await app.ready();
    let userId = '';
    let courseId = '';
    try {
      const registration = await registerStudent(app, { fullName: 'Local progression regression', password: crypto.randomUUID() });
      assert.equal(registration.statusCode, 201);
      userId = registration.json<{ user: { id: string } }>().user.id;
      const student = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId } });
      const course = await app.prisma.course.create({
        data: {
          title: 'Isolated empty unit regression', slug: crypto.randomUUID(), createdById: userId,
          status: 'PUBLISHED', accessLevel: 'ENROLLED',
          units: { create: [1, 2, 3, 4].map((position) => ({
            title: `Unit ${position}`, position, status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const,
            ...(position <= 2 ? { lessons: { create: {
              title: `Lesson ${position}`, position: 1, status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const,
              videos: { create: { title: `Video ${position}`, position: 1, type: 'EXPLANATION' as const,
                status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const, durationSeconds: 100 } },
            } } } : {}),
          })) },
        },
        include: { units: { orderBy: { position: 'asc' }, include: { lessons: { include: { videos: true } } } } },
      });
      courseId = course.id;
      await app.prisma.courseEnrollment.create({ data: { courseId, studentId: student.id, status: 'ACTIVE', source: 'MANUAL' } });
      const progression = new ProgressionService(app.prisma);
      const initial = await progression.courseRoadmap(student.id, courseId);
      assert.deepEqual(initial.map((unit) => unit.state), ['AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED']);
      assert.deepEqual(initial.map((unit) => unit.progressPercent), [0, 0, 0, 0]);
      assert.equal(initial.flatMap((unit) => unit.requirements).filter((item) => item.complete).length, 0);
      assert.equal(await app.prisma.studentVideoProgress.count({ where: { studentId: student.id } }), 0);
      assert.equal(await app.prisma.homeworkSubmission.count({ where: { studentId: student.id } }), 0);
      assert.equal(await app.prisma.examAttempt.count({ where: { studentId: student.id } }), 0);
      const firstVideoId = course.units[0]!.lessons[0]!.videos[0]!.id;
      await app.prisma.studentVideoProgress.create({ data: { studentId: student.id, videoId: firstVideoId,
        watchedSeconds: 95, durationSeconds: 100, progressPercent: 95, completedAt: new Date(), lastWatchedAt: new Date() } });
      const afterFirst = await progression.courseRoadmap(student.id, courseId);
      assert.deepEqual(afterFirst.map((unit) => unit.state), ['COMPLETED', 'AVAILABLE', 'LOCKED', 'LOCKED']);
      const secondVideoId = course.units[1]!.lessons[0]!.videos[0]!.id;
      await app.prisma.studentVideoProgress.create({ data: { studentId: student.id, videoId: secondVideoId,
        watchedSeconds: 95, durationSeconds: 100, progressPercent: 95, completedAt: new Date(), lastWatchedAt: new Date() } });
      const afterSecond = await progression.courseRoadmap(student.id, courseId);
      assert.deepEqual(afterSecond.map((unit) => unit.state), ['COMPLETED', 'COMPLETED', 'AVAILABLE', 'LOCKED']);
      assert.equal(afterSecond[2]!.progressPercent, 0);
      assert.equal(afterSecond[3]!.progressPercent, 0);

      const homework = new HomeworkService(app.prisma);
      const exam = new ExamService(app.prisma);
      const lessonId = course.units[0]!.lessons[0]!.id;
      await assert.rejects(homework.create({ lessonId, title: 'Empty', status: 'PUBLISHED' }), { code: 'QUESTIONS_REQUIRED' });
      const draftHomework = await homework.create({ lessonId, title: 'Draft' });
      await assert.rejects(homework.update(draftHomework.id, { status: 'PUBLISHED' }), { code: 'QUESTIONS_REQUIRED' });
      const legacyHomework = await app.prisma.homework.create({ data: { lessonId, title: 'Legacy empty', status: 'PUBLISHED' } });
      await assert.rejects(homework.start(userId, legacyHomework.id), { code: 'QUESTIONS_REQUIRED' });
      await assert.rejects(homework.submit(userId, legacyHomework.id, []), { code: 'QUESTIONS_REQUIRED' });
      await assert.rejects(exam.create({ courseId, title: 'Empty', status: 'PUBLISHED' }), { code: 'QUESTIONS_REQUIRED' });
      const draftExam = await exam.create({ courseId, title: 'Draft' });
      await assert.rejects(exam.update(draftExam.id, { status: 'PUBLISHED' }), { code: 'QUESTIONS_REQUIRED' });
      const legacyExam = await app.prisma.exam.create({ data: { courseId, title: 'Legacy empty', status: 'PUBLISHED' } });
      await assert.rejects(exam.start(userId, legacyExam.id), { code: 'QUESTIONS_REQUIRED' });
      assert.equal(await app.prisma.examAttempt.count({ where: { examId: legacyExam.id } }), 0);
      await homework.addQuestion(draftHomework.id, { type: 'SINGLE_CHOICE', prompt: 'Choose A', position: 0, points: 1,
        choices: [{ label: 'A', position: 0, isCorrect: true }, { label: 'B', position: 1 }] });
      assert.equal((await homework.update(draftHomework.id, { status: 'PUBLISHED' })).status, 'PUBLISHED');
      const section = await exam.addSection(draftExam.id, { title: 'Questions', position: 0 });
      await assert.rejects(exam.update(draftExam.id, { status: 'PUBLISHED' }), { code: 'QUESTIONS_REQUIRED' });
      await exam.addQuestion(section.id, { type: 'SINGLE_CHOICE', prompt: 'Choose B', position: 0, points: 1,
        choices: [{ label: 'A', position: 0 }, { label: 'B', position: 1, isCorrect: true }] });
      assert.equal((await exam.update(draftExam.id, { status: 'PUBLISHED' })).status, 'PUBLISHED');
    } finally {
      if (courseId) {
        await app.prisma.exam.deleteMany({ where: { courseId } });
        await app.prisma.homework.deleteMany({ where: { lesson: { unit: { courseId } } } });
        await app.prisma.studentVideoProgress.deleteMany({ where: { video: { lesson: { unit: { courseId } } } } });
        await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
        await app.prisma.course.delete({ where: { id: courseId } });
      }
      if (userId) await app.prisma.user.delete({ where: { id: userId } });
      await app.close();
    }
  });
}
