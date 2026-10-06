import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import { StorageService } from '../src/services/storage.service.js';
import { registerStudent } from './register-student.js';

const database = new URL(env.DATABASE_URL);
const localHarness = ['localhost', '127.0.0.1'].includes(database.hostname) &&
  database.pathname === '/englishine';

class NoStorageWrites extends StorageService {
  override remove(): Promise<void> {
    return Promise.reject(new Error('Deletion test attempted an unexpected storage write'));
  }
}

void test('Admin deletes only unused content; missing, unauthorized and repeated requests stay safe', { skip: !localHarness }, async () => {
  const app = await buildApp({ storage: new NoStorageWrites() });
  await app.ready();
  const users: string[] = [];
  const courses: string[] = [];
  try {
    const password = randomUUID();
    const adminRegistration = await registerStudent(app, { fullName: 'Isolated delete QA admin', password });
    const learnerRegistration = await registerStudent(app, { fullName: 'Isolated delete QA student', password: randomUUID() });
    assert.equal(adminRegistration.statusCode, 201);
    assert.equal(learnerRegistration.statusCode, 201);
    const admin = adminRegistration.json<{ user: { id: string }; accessToken: string }>();
    const learner = learnerRegistration.json<{ user: { id: string }; accessToken: string }>();
    users.push(admin.user.id, learner.user.id);
    const role = await app.prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } });
    await app.prisma.userRole.create({ data: { userId: admin.user.id, roleId: role.id } });
    const account = await app.prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } });
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      payload: { identifier: account.phone, password }, headers: { 'x-device-id': randomUUID() } });
    assert.equal(login.statusCode, 200);
    const adminHeaders = { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` };
    const studentHeaders = { authorization: `Bearer ${learner.accessToken}` };
    const base = '/api/v1/admin';
    const createCourse = async (title: string) => {
      const course = await app.prisma.course.create({ data: {
        title, slug: `delete-qa-${randomUUID()}`, createdById: admin.user.id,
      } });
      courses.push(course.id);
      return course;
    };

    const empty = await createCourse('Isolated empty course');
    const coursePath = `${base}/courses/${empty.id}`;
    assert.equal((await app.inject({ method: 'DELETE', url: coursePath })).statusCode, 401);
    assert.equal((await app.inject({ method: 'DELETE', url: coursePath, headers: studentHeaders })).statusCode, 403);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/courses/${randomUUID()}`, headers: adminHeaders })).statusCode, 404);
    assert.equal((await app.inject({ method: 'DELETE', url: coursePath, headers: adminHeaders })).statusCode, 204);
    assert.equal((await app.inject({ method: 'DELETE', url: coursePath, headers: adminHeaders })).statusCode, 404);

    const course = await createCourse('Isolated hierarchy');
    const unit = await app.prisma.courseUnit.create({ data: { courseId: course.id, title: 'Unit', position: 0 } });
    const lesson = await app.prisma.lesson.create({ data: { unitId: unit.id, title: 'Lesson', position: 0 } });
    const blocked = await app.inject({ method: 'DELETE', url: `${base}/courses/${course.id}`, headers: adminHeaders });
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.json<{ error: { code: string } }>().error.code, 'COURSE_HAS_DEPENDENCIES');
    assert.doesNotMatch(blocked.body, /Prisma|CourseUnit_courseId_position_key|SELECT /);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/units/${unit.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/lessons/${lesson.id}`, headers: adminHeaders })).statusCode, 204);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/units/${unit.id}`, headers: adminHeaders })).statusCode, 204);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/courses/${course.id}`, headers: adminHeaders })).statusCode, 204);

    const historyCourse = await createCourse('Isolated history');
    const historyUnit = await app.prisma.courseUnit.create({ data: { courseId: historyCourse.id, title: 'History unit', position: 0 } });
    const historyLesson = await app.prisma.lesson.create({ data: { unitId: historyUnit.id, title: 'History lesson', position: 0 } });
    const video = await app.prisma.video.create({ data: { lessonId: historyLesson.id, title: 'History video', type: 'EXPLANATION', position: 0 } });
    const videoGate = await app.prisma.progressionRequirement.create({ data: { lessonId: historyLesson.id, type: 'VIDEO_COMPLETE', targetId: video.id } });
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/videos/${video.id}`, headers: adminHeaders })).statusCode, 409);
    await app.prisma.progressionRequirement.delete({ where: { id: videoGate.id } });
    const profile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: learner.user.id } });
    await app.prisma.studentVideoProgress.create({ data: { studentId: profile.id, videoId: video.id } });
    const videoBlocked = await app.inject({ method: 'DELETE', url: `${base}/videos/${video.id}`, headers: adminHeaders });
    assert.equal(videoBlocked.statusCode, 409);
    assert.equal(videoBlocked.json<{ error: { code: string } }>().error.code, 'VIDEO_HAS_DEPENDENCIES');

    const homework = await app.prisma.homework.create({ data: { lessonId: historyLesson.id, title: 'Attempted homework' } });
    const homeworkGate = await app.prisma.progressionRequirement.create({ data: { lessonId: historyLesson.id, type: 'HOMEWORK_PASSED', targetId: homework.id } });
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/homework/${homework.id}`, headers: adminHeaders })).statusCode, 409);
    await app.prisma.progressionRequirement.delete({ where: { id: homeworkGate.id } });
    const unusedQuestion = await app.prisma.homeworkQuestion.create({ data: { homeworkId: homework.id, type: 'SINGLE_CHOICE', prompt: 'Unused question', position: 0 } });
    const questionPath = `${base}/homework-questions/${unusedQuestion.id}`;
    assert.equal((await app.inject({ method: 'DELETE', url: questionPath, headers: adminHeaders })).statusCode, 204);
    assert.equal((await app.inject({ method: 'DELETE', url: questionPath, headers: adminHeaders })).statusCode, 404);
    const attemptedQuestion = await app.prisma.homeworkQuestion.create({ data: { homeworkId: homework.id, type: 'SINGLE_CHOICE', prompt: 'Attempted question', position: 0 } });
    await app.prisma.homeworkSubmission.create({ data: { homeworkId: homework.id, studentId: profile.id, attemptNo: 1 } });
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/homework-questions/${attemptedQuestion.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/homework/${homework.id}`, headers: adminHeaders })).statusCode, 409);

    const exam = await app.prisma.exam.create({ data: { courseId: historyCourse.id, lessonId: historyLesson.id, title: 'Attempted exam' } });
    const examGate = await app.prisma.progressionRequirement.create({ data: { lessonId: historyLesson.id, type: 'EXAM_PASSED', targetId: exam.id } });
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/exams/${exam.id}`, headers: adminHeaders })).statusCode, 409);
    await app.prisma.progressionRequirement.delete({ where: { id: examGate.id } });
    const section = await app.prisma.examSection.create({ data: { examId: exam.id, title: 'Section', position: 0 } });
    const examQuestion = await app.prisma.examQuestion.create({ data: { sectionId: section.id, type: 'SINGLE_CHOICE', prompt: 'Attempted exam question', position: 0, points: 1 } });
    await app.prisma.examAttempt.create({ data: { examId: exam.id, studentId: profile.id, attemptNo: 1 } });
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/exam-questions/${examQuestion.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/exams/${exam.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/lessons/${historyLesson.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/units/${historyUnit.id}`, headers: adminHeaders })).statusCode, 409);
    assert.equal((await app.inject({ method: 'DELETE', url: `${base}/courses/${historyCourse.id}`, headers: adminHeaders })).statusCode, 409);
  } finally {
    if (courses.length) {
      await app.prisma.studentVideoProgress.deleteMany({ where: { video: { lesson: { unit: { courseId: { in: courses } } } } } });
      await app.prisma.homeworkSubmission.deleteMany({ where: { homework: { lesson: { unit: { courseId: { in: courses } } } } } });
      await app.prisma.examAttempt.deleteMany({ where: { exam: { courseId: { in: courses } } } });
      await app.prisma.exam.deleteMany({ where: { courseId: { in: courses } } });
      await app.prisma.course.deleteMany({ where: { id: { in: courses } } });
    }
    if (users.length) await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  }
});
