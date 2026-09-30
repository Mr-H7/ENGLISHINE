import assert from 'node:assert/strict';
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
import { registerStudent, testPhone } from './register-student.js';
import { ExamService } from '../src/services/exam.service.js';
import { ProgressionService } from '../src/services/progression.service.js';

const app = await buildApp();
await app.ready();
const ids: string[] = [];
after(async () => {
  await app.prisma.studentVideoProgress.deleteMany({ where: { student: { userId: { in: ids } } } });
  await app.prisma.studentLessonProgress.deleteMany({ where: { student: { userId: { in: ids } } } });
  await app.prisma.courseEnrollment.deleteMany({ where: { student: { userId: { in: ids } } } });
  await app.prisma.examAttempt.deleteMany({ where: { student: { userId: { in: ids } } } });
  await app.prisma.exam.deleteMany({ where: { course: { createdById: { in: ids } } } });
  await app.prisma.course.deleteMany({ where: { createdById: { in: ids } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.close();
});

void test('phone signup, admin grade control, progression lock, and video completion', async () => {
  const password = 'Englishine-Test-2026!';
  const first = await registerStudent(app, { fullName: 'طالب التقدم', email: `prog-${crypto.randomUUID()}@example.test`, password });
  assert.equal(first.statusCode, 201);
  const firstUser = first.json<{ accessToken: string; user: { id: string; email: string } }>().user;
  ids.push(firstUser.id);
  const studentHeaders = { authorization: `Bearer ${first.json<{ accessToken: string }>().accessToken}` };

  const phoneOnly = await registerStudent(app, { fullName: 'طالب بدون بريد', password });
  assert.equal(phoneOnly.statusCode, 201);
  ids.push(phoneOnly.json<{ user: { id: string } }>().user.id);
  const loginPhone = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-device-id': crypto.randomUUID() },
    payload: { identifier: phoneOnly.json<{ user: { phone: string } }>().user.phone, password },
  });
  assert.equal(loginPhone.statusCode, 200);

  const gradeDenied = await app.inject({
    method: 'PATCH',
    url: '/api/v1/student/profile/grade',
    headers: { ...studentHeaders, 'content-type': 'application/json' },
    payload: { gradeId: (await app.prisma.grade.findFirstOrThrow()).id },
  });
  assert.equal(gradeDenied.statusCode, 404);

  const adminReg = await registerStudent(app, { fullName: 'مشرف التقدم', email: `adm-${crypto.randomUUID()}@example.test`, password });
  const adminId = adminReg.json<{ user: { id: string } }>().user.id;
  ids.push(adminId);
  const adminRole = await app.prisma.role.findUniqueOrThrow({ where: { key: SystemRole.ADMIN } });
  await app.prisma.userRole.create({ data: { userId: adminId, roleId: adminRole.id } });
  const adminHeaders = { authorization: `Bearer ${adminReg.json<{ accessToken: string }>().accessToken}` };

  const student = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: firstUser.id } });
  const otherGrade = await app.prisma.grade.findFirstOrThrow({ where: { NOT: { id: student.gradeId ?? '' } } });
  const adminGrade = await app.inject({
    method: 'PATCH',
    url: `/api/v1/admin/students/${student.id}/grade`,
    headers: { ...adminHeaders, 'content-type': 'application/json' },
    payload: { gradeId: otherGrade.id },
  });
  assert.equal(adminGrade.statusCode, 200);

  const course = await app.prisma.course.create({
    data: {
      createdById: adminId,
      title: 'Progression course',
      slug: `prog-${crypto.randomUUID()}`,
      status: CourseStatus.PUBLISHED,
      accessLevel: AccessLevel.ENROLLED,
      publishedAt: new Date(),
      units: {
        create: [
          {
            title: 'Unit 1',
            position: 0,
            status: ContentStatus.PUBLISHED,
            lessons: {
              create: {
                title: 'Lesson 1',
                position: 0,
                status: ContentStatus.PUBLISHED,
                accessLevel: AccessLevel.ENROLLED,
                videos: {
                  create: {
                    title: 'Video 1',
                    type: 'EXPLANATION',
                    status: ContentStatus.PUBLISHED,
                    accessLevel: AccessLevel.ENROLLED,
                    position: 0,
                    durationSeconds: 100,
                  },
                },
              },
            },
          },
          {
            title: 'Unit 2',
            position: 1,
            status: ContentStatus.PUBLISHED,
            lessons: {
              create: {
                title: 'Lesson 2',
                position: 0,
                status: ContentStatus.PUBLISHED,
                accessLevel: AccessLevel.ENROLLED,
              },
            },
          },
        ],
      },
    },
    include: { units: { include: { lessons: { include: { videos: true } } } } },
  });
  await app.prisma.courseEnrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      status: EnrollmentStatus.ACTIVE,
      source: EnrollmentSource.MANUAL,
    },
  });
  const unit2Lesson = course.units.find((unit) => unit.position === 1)!.lessons[0]!;
  const locked = await app.inject({
    method: 'GET',
    url: `/api/v1/student/lessons/${unit2Lesson.id}`,
    headers: studentHeaders,
  });
  assert.equal(locked.statusCode, 403);
  assert.equal(locked.json<{ error: { code: string } }>().error.code, 'PROGRESSION_LOCKED');

  const video = course.units[0]!.lessons[0]!.videos[0]!;
  const watched = await app.inject({
    method: 'PUT',
    url: `/api/v1/student/progress/videos/${video.id}`,
    headers: { ...studentHeaders, 'content-type': 'application/json' },
    payload: { watchedSeconds: 91, durationSeconds: 100 },
  });
  assert.equal(watched.statusCode, 200);
  const open = await app.inject({
    method: 'GET',
    url: `/api/v1/student/lessons/${unit2Lesson.id}`,
    headers: studentHeaders,
  });
  assert.equal(open.statusCode, 200);

  const firstUnit = course.units.find((unit) => unit.position === 0)!;
  const exam = await app.prisma.exam.create({ data: { courseId: course.id, unitId: firstUnit.id, lessonId: firstUnit.lessons[0]!.id, title: 'Local resume regression', status: 'PUBLISHED', maxAttempts: 1 } });
  const roadmap = await new ProgressionService(app.prisma).courseRoadmap(student.id, course.id);
  for (const unit of roadmap) assert.equal(new Set(unit.requirements.map((item) => item.key)).size, unit.requirements.length);
  const exams = new ExamService(app.prisma);
  const started = await exams.start(firstUser.id, exam.id);
  const resumed = await exams.start(firstUser.id, exam.id);
  assert.equal(resumed.attempt.id, started.attempt.id);
  assert.equal(await app.prisma.examAttempt.count({ where: { examId: exam.id } }), 1);
  await app.prisma.examAttempt.update({ where: { id: started.attempt.id }, data: { expiresAt: new Date(0) } });
  await assert.rejects(() => exams.start(firstUser.id, exam.id), { code: 'MAX_ATTEMPTS_REACHED' });

  const blockedSignup = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: { 'content-type': 'application/json', 'x-device-id': crypto.randomUUID() },
    payload: {
      fullName: 'مكرر هاتف',
      password,
      studentPhone: testPhone(),
      guardianPhone: testPhone(),
      gradeId: otherGrade.id,
    },
  });
  assert.ok([201, 409].includes(blockedSignup.statusCode));
  if (blockedSignup.statusCode === 201) {
    ids.push(blockedSignup.json<{ user: { id: string } }>().user.id);
  }
});
