import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import { ActivationService } from '../src/services/activation.service.js';
import { EnrollmentService } from '../src/services/enrollment.service.js';
import { StudentPlatformService } from '../src/services/student-platform.service.js';
import { ExamService } from '../src/services/exam.service.js';
import { registerStudent } from './register-student.js';
import { env } from '../src/config/env.js';

if (!['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname) || env.STORAGE_DRIVER !== 'local') {
  void test('stage 3 blockers skipped unless STORAGE_DRIVER=local', { skip: true }, () => {});
} else {
const app = await buildApp();
await app.ready();
const users: string[] = [];
let courseId = '';
let assetId = '';
after(async () => {
  if (courseId) {
    await app.prisma.examAttempt.deleteMany({ where: { exam: { courseId } } });
    await app.prisma.exam.deleteMany({ where: { courseId } });
    await app.prisma.homeworkSubmission.deleteMany({ where: { homework: { lesson: { unit: { courseId } } } } });
    await app.prisma.activationCodeRedemption.deleteMany({ where: { student: { userId: { in: users } } } });
    await app.prisma.activationCode.deleteMany({ where: { createdById: { in: users } } });
    await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
    await app.prisma.course.delete({ where: { id: courseId } });
  }
  if (assetId) await app.prisma.fileAsset.delete({ where: { id: assetId } });
  await app.prisma.user.deleteMany({ where: { id: { in: users } } });
  await app.close();
});

async function student() {
  const response = await registerStudent(app, { fullName: 'Stage 3 regression', password: 'Local-Stage3-Test!2026' });
  assert.equal(response.statusCode, 201);
  const auth = response.json<{ user: { id: string }; accessToken: string }>();
  users.push(auth.user.id);
  const profile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: auth.user.id } });
  return { userId: auth.user.id, profile, headers: { authorization: `Bearer ${auth.accessToken}` } };
}

void test('activation-only hierarchy and multi-answer homework preserve authorization and persistence', async () => {
  const owner = await student();
  const unitStudent = await student();
  const lessonStudent = await student();
  const lockedStudent = await student();
  const outsider = await student();
  const course = await app.prisma.course.create({ data: {
    title: 'Stage 3 scoped regression', slug: `stage3-${crypto.randomUUID()}`, createdById: owner.userId,
    gradeId: owner.profile.gradeId, status: 'PUBLISHED', accessLevel: 'ENROLLED',
    units: { create: [1, 2].map((position) => ({ title: `Unit ${position}`, position, status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const,
      lessons: { create: [1, 2].map((order) => ({ title: `Lesson ${position}.${order}`, position: order, status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const,
        videos: { create: { title: 'Protected video', type: 'EXPLANATION' as const, position: 1, status: 'PUBLISHED' as const, accessLevel: 'ENROLLED' as const, durationSeconds: 60 } },
      })) },
    })) },
  }, include: { units: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { videos: true } } } } } });
  courseId = course.id;
  const first = course.units[0]!;
  const second = course.units[1]!;
  const lesson = first.lessons[0]!;
  const sibling = first.lessons[1]!;
  const asset = await app.prisma.fileAsset.create({ data: { storageProvider: 'local', storageKey: `tests/stage3-${crypto.randomUUID()}.mp4`, originalName: 'test.mp4', mimeType: 'video/mp4', byteSize: 1n } });
  assetId = asset.id;
  await app.prisma.video.update({ where: { id: sibling.videos[0]!.id }, data: { fileAssetId: asset.id } });
  const activation = new ActivationService(app.prisma);
  async function redeem(target: typeof owner, unlockType: 'UNIT' | 'LESSON', targetId: string) {
    const code = await activation.create({ unlockType, targetId, maxUses: 1 }, owner.userId);
    const response = await app.inject({ method: 'POST', url: '/api/v1/student/activation', headers: target.headers, payload: { code: code.code } });
    assert.equal(response.statusCode, 200);
  }
  await redeem(unitStudent, 'UNIT', first.id);
  await redeem(lessonStudent, 'LESSON', lesson.id);
  await redeem(lockedStudent, 'UNIT', second.id);
  assert.equal(await app.prisma.courseEnrollment.count({ where: { courseId } }), 0);
  assert.equal(await app.prisma.studentLessonProgress.count({ where: { studentId: { in: [unitStudent.profile.id, lessonStudent.profile.id, lockedStudent.profile.id] } } }), 0);
  assert.equal(await app.prisma.studentVideoProgress.count({ where: { studentId: { in: [unitStudent.profile.id, lessonStudent.profile.id, lockedStudent.profile.id] } } }), 0);
  const enrollment = new EnrollmentService(app.prisma);
  const platform = new StudentPlatformService(app.prisma);
  const unitContext = await enrollment.myCourse(unitStudent.userId, courseId);
  assert.equal(unitContext?.accessKind, 'ACTIVATION');
  assert.equal(unitContext?.id, null);
  assert.deepEqual(unitContext?.course.units.map((unit) => unit.id), [first.id]);
  assert.deepEqual(unitContext?.course.units[0]?.lessons.map((item) => item.id), [lesson.id, sibling.id]);
  const lessonContext = await enrollment.myCourse(lessonStudent.userId, courseId);
  assert.deepEqual(lessonContext?.course.units.map((unit) => unit.id), [first.id]);
  assert.deepEqual(lessonContext?.course.units[0]?.lessons.map((item) => item.id), [lesson.id]);
  assert.equal((await enrollment.myCourses(lessonStudent.userId))[0]?.accessKind, 'ACTIVATION');
  const roadmap = await platform.roadmap(lessonStudent.userId, courseId);
  assert.equal(roadmap.length, 1);
  assert.equal(roadmap[0]?.entitled, false);
  assert.equal(roadmap[0]?.contextAccessible, true);
  assert.deepEqual(roadmap[0]?.lessons.map((row) => row.lessonId), [lesson.id]);
  assert.equal(roadmap[0]?.lessons[0]?.state, 'AVAILABLE');
  assert.equal((await platform.progress(lessonStudent.userId)).length, 1);
  const requestLesson = (target: typeof owner, id: string) => app.inject({ method: 'GET', url: `/api/v1/student/lessons/${id}`, headers: target.headers });
  assert.equal((await requestLesson(unitStudent, lesson.id)).statusCode, 200);
  assert.equal((await requestLesson(unitStudent, sibling.id)).statusCode, 200);
  assert.equal((await requestLesson(lessonStudent, lesson.id)).statusCode, 200);
  assert.equal((await requestLesson(lessonStudent, sibling.id)).statusCode, 403);
  assert.equal((await requestLesson(unitStudent, second.lessons[0]!.id)).statusCode, 403);
  const locked = await requestLesson(lockedStudent, second.lessons[0]!.id);
  assert.equal(locked.statusCode, 403);
  assert.equal(locked.json<{ error: { code: string } }>().error.code, 'PROGRESSION_LOCKED');
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/courses/${courseId}`, headers: outsider.headers })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/media/videos/${sibling.videos[0]!.id}`, headers: lessonStudent.headers })).statusCode, 403);
  const enrolled = await app.prisma.courseEnrollment.create({ data: { studentId: owner.profile.id, courseId, status: 'ACTIVE', source: 'MANUAL' } });
  const enrolledContext = await enrollment.myCourse(owner.userId, courseId);
  assert.equal(enrolledContext?.accessKind, 'ENROLLMENT');
  assert.equal(enrolledContext?.id, enrolled.id);
  assert.equal(enrolledContext?.course.units.length, 2);
  await redeem(owner, 'LESSON', lesson.id);
  assert.equal((await enrollment.myCourses(owner.userId)).length, 1);

  const examService = new ExamService(app.prisma);
  const ownedExam = await examService.create({ courseId, lessonId: lesson.id, title: 'Scoped exam', status: 'PUBLISHED' });
  const siblingExam = await examService.create({ courseId, lessonId: sibling.id, title: 'Sibling exam', status: 'PUBLISHED' });
  const unitExam = await examService.create({ courseId, unitId: first.id, title: 'Unit exam', status: 'PUBLISHED' });
  const lockedExam = await examService.create({ courseId, unitId: second.id, title: 'Locked unit exam', status: 'PUBLISHED' });
  assert.deepEqual((await platform.exams(lessonStudent.userId)).map((item) => item.id), [ownedExam.id]);
  await examService.start(lessonStudent.userId, ownedExam.id);
  await examService.start(unitStudent.userId, siblingExam.id);
  await examService.start(unitStudent.userId, unitExam.id);
  await assert.rejects(examService.start(lessonStudent.userId, siblingExam.id), { code: 'ENROLLMENT_REQUIRED' });
  await assert.rejects(examService.start(lessonStudent.userId, unitExam.id), { code: 'ENROLLMENT_REQUIRED' });
  await assert.rejects(examService.start(lockedStudent.userId, lockedExam.id), { code: 'PROGRESSION_LOCKED' });
  assert.equal(await app.prisma.courseEnrollment.count({ where: { studentId: lessonStudent.profile.id } }), 0);

  const homework = await app.prisma.homework.create({ data: { lessonId: lesson.id, title: 'Multi answer regression', status: 'PUBLISHED', maxScore: 10, maxAttempts: 10,
    questions: { create: [
      { type: 'MULTIPLE_CHOICE', prompt: 'Select A and C', position: 1, points: 5, choices: { create: [
        { label: 'A', position: 1, isCorrect: true }, { label: 'B', position: 2, isCorrect: false }, { label: 'C', position: 3, isCorrect: true },
      ] } },
      { type: 'SINGLE_CHOICE', prompt: 'Select X', position: 2, points: 5, choices: { create: [{ label: 'X', position: 1, isCorrect: true }, { label: 'Y', position: 2 }] } },
    ] },
  }, include: { questions: { orderBy: { position: 'asc' }, include: { choices: { orderBy: { position: 'asc' } } } } } });
  const multi = homework.questions[0]!;
  const single = homework.questions[1]!;
  const [a, b, c] = multi.choices.map((choice) => choice.id) as [string, string, string];
  const submit = (answers: unknown[]) => app.inject({ method: 'POST', url: `/api/v1/student/homework/${homework.id}/submissions`, headers: lessonStudent.headers, payload: { answers } });
  for (const [ids, score] of [[[a, c], 5], [[c, a], 5], [[a], 0], [[a, b, c], 0], [[], 0]] as Array<[string[], number]>) {
    const response = await submit([{ questionId: multi.id, selectedChoiceIds: ids }]);
    assert.equal(response.statusCode, 201);
    const data = response.json<{ data: { score: null; reviewStatus: string; answers: { awardedPoints: string; selectedChoices: { choiceId: string }[] }[] } }>().data;
    assert.equal(Number(data.answers[0]?.awardedPoints), score);
    assert.deepEqual(data.answers[0]?.selectedChoices.map((choice) => choice.choiceId).sort(), [...ids].sort());
    assert.equal(data.score, null); // Final score remains the existing teacher-review workflow.
    assert.equal(data.reviewStatus, 'PENDING');
  }
  for (const answer of [
    { questionId: multi.id, selectedChoiceIds: [a, a] },
    { questionId: multi.id, selectedChoiceIds: [single.choices[0]!.id] },
    { questionId: multi.id, selectedChoiceId: a, selectedChoiceIds: [a] },
    { questionId: single.id, selectedChoiceIds: single.choices.map((choice) => choice.id) },
    { questionId: crypto.randomUUID(), selectedChoiceIds: [a] },
  ]) assert.equal((await submit([answer])).statusCode, 400);
  const legacy = await submit([{ questionId: single.id, selectedChoiceId: single.choices[0]!.id }]);
  assert.equal(legacy.statusCode, 201);
  assert.equal(legacy.json<{ data: { answers: { selectedChoiceId: string; awardedPoints: null }[] } }>().data.answers[0]?.selectedChoiceId, single.choices[0]!.id);
  assert.equal(legacy.json<{ data: { answers: { awardedPoints: null }[] } }>().data.answers[0]?.awardedPoints, null);
  await submit([{ questionId: multi.id, selectedChoiceIds: [c, a] }]);
  const reload = await app.inject({ method: 'GET', url: `/api/v1/student/homework/${homework.id}`, headers: lessonStudent.headers });
  assert.equal(reload.statusCode, 200);
  const saved = reload.json<{ data: { maxScore: string; submission: { answers: { selectedChoices: { choiceId: string }[] }[] } } }>().data;
  assert.equal(Number(saved.maxScore), 10);
  assert.deepEqual(saved.submission.answers[0]?.selectedChoices.map((choice) => choice.choiceId).sort(), [a, c].sort());
  // A free preview is accessible without owning its course roadmap. Requirements
  // must authorize the lesson itself and never post an activation code.
  await app.prisma.video.update({ where: { id: sibling.videos[0]!.id }, data: { accessLevel: 'FREE' } });
  assert.equal((await requestLesson(outsider, sibling.id)).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/courses/${courseId}/roadmap`, headers: outsider.headers })).statusCode, 403);
  const requirements = await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${sibling.id}/requirements`, headers: outsider.headers });
  assert.equal(requirements.statusCode, 200);
  assert.deepEqual(requirements.json<{ data: { requirements: { key: string }[] } }>().data.requirements.map((item) => item.key), [`video:${sibling.videos[0]!.id}`]);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${lesson.id}/requirements`, headers: outsider.headers })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/api/v1/student/lessons/${lesson.id}/requirements`, headers: lessonStudent.headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/student/activation', headers: outsider.headers, payload: { code: 'short' } })).statusCode, 400);
});
}
