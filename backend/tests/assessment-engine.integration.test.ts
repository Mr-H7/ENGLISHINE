import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/create-app.js';
import { env } from '../src/config/env.js';
import { HomeworkService } from '../src/services/homework.service.js';
import { ExamService } from '../src/services/exam.service.js';
import { AssessmentAdminService } from '../src/services/assessment-admin.service.js';
import { ProgressionService } from '../src/services/progression.service.js';
import { gradeAnswers, summarizeMarks } from '../src/services/assessment-engine.js';
import { registerStudent } from './register-student.js';

void test('shared deterministic grading preserves exact sets, text and manual review', () => {
  const questions = [
    { id: 'single', type: 'SINGLE_CHOICE', points: 2, correctText: null, choices: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: false }] },
    { id: 'boolean', type: 'TRUE_FALSE', points: 2, correctText: null, choices: [{ id: 'true', isCorrect: true }, { id: 'false', isCorrect: false }] },
    { id: 'short', type: 'SHORT_TEXT', points: 2, correctText: 'Hello', choices: [] },
    { id: 'essay', type: 'LONG_TEXT', points: 4, correctText: 'Never auto-grade essays', choices: [] },
  ];
  const graded = gradeAnswers(questions, [{ questionId: 'single', choiceIds: ['a'] }, { questionId: 'boolean', choiceIds: ['true'] }, { questionId: 'short', textAnswer: ' HELLO ' }, { questionId: 'essay', textAnswer: 'Never auto-grade essays' }]);
  assert.deepEqual(graded.map((g) => g.awardedPoints), [2, 2, 2, null]);
  assert.equal(summarizeMarks([2, 2, 2, null], 10, 60).passed, null);
  assert.equal(summarizeMarks([2, 2, 2, 0], 10, 60).passed, true);
  assert.equal(summarizeMarks([2, 0, 0, 0], 10, 60).passed, false);
  assert.equal(gradeAnswers([{ id: 'unconfigured', type: 'SHORT_TEXT', points: 1, correctText: '  ', choices: [] }], [])[0]?.awardedPoints, null);
  assert.equal(summarizeMarks([1], 3, 33.34).passed, false);
  assert.throws(() => gradeAnswers(questions, [{ questionId: 'single', choiceIds: ['true'] }]), { code: 'INVALID_CHOICE' });
  assert.throws(() => gradeAnswers(questions, [{ questionId: 'single', choiceIds: ['a', 'a'] }]), { code: 'DUPLICATE_CHOICES' });
  assert.throws(() => gradeAnswers(questions, [{ questionId: 'foreign' }]), { code: 'INVALID_QUESTION' });
});

if (!['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname) || new URL(env.DATABASE_URL).pathname !== '/englishine' || env.STORAGE_DRIVER !== 'local') {
  void test('assessment integration requires localhost/englishine and local storage', { skip: true }, () => {});
} else {
void test('real attempts, grants, manual grades and pass gates preserve entitlement and history', async () => {
  const app = await buildApp(); await app.ready();
  const users: string[] = []; let courseId = ''; let assetId = '';
  try {
    async function student() {
      const response = await registerStudent(app, { fullName: 'Assessment isolated regression', password: crypto.randomUUID() });
      assert.equal(response.statusCode, 201);
      const auth = response.json<{ user: { id: string }; accessToken: string }>(); users.push(auth.user.id);
      const profile = await app.prisma.studentProfile.findUniqueOrThrow({ where: { userId: auth.user.id } });
      return { userId: auth.user.id, profile, headers: { authorization: `Bearer ${auth.accessToken}` } };
    }
    const owner = await student(), learner = await student(), outsider = await student();
    const course = await app.prisma.course.create({ data: { title: 'Isolated assessment engine', slug: crypto.randomUUID(), createdById: owner.userId, status: 'PUBLISHED', accessLevel: 'ENROLLED', units: { create: { title: 'Unit', position: 0, status: 'PUBLISHED', accessLevel: 'ENROLLED', lessons: { create: [{ title: 'Source', position: 0, status: 'PUBLISHED', accessLevel: 'ENROLLED' }, { title: 'Target', position: 1, status: 'PUBLISHED', accessLevel: 'ENROLLED' }] } } } }, include: { units: { include: { lessons: { orderBy: { position: 'asc' } } } } } });
    courseId = course.id;
    const source = course.units[0]!.lessons[0]!, target = course.units[0]!.lessons[1]!;
    await app.prisma.courseEnrollment.create({ data: { courseId, studentId: learner.profile.id, status: 'ACTIVE', source: 'MANUAL' } });
    const hw = new HomeworkService(app.prisma), exams = new ExamService(app.prisma), admin = new AssessmentAdminService(app.prisma), progression = new ProgressionService(app.prisma);
    const homework = await hw.create({ lessonId: source.id, title: 'Retry test', passingPercentage: 60 });
    const question = await hw.addQuestion(homework.id, { type: 'SINGLE_CHOICE', prompt: 'Choose A', points: 10, position: 0, choices: [{ label: 'A', position: 0, isCorrect: true }, { label: 'B', position: 1 }] });
    await hw.update(homework.id, { status: 'PUBLISHED' });
    await admin.dependency('homework', homework.id, { lessonId: target.id });
    await assert.rejects(admin.dependency('homework', homework.id, { lessonId: source.id }), { code: 'DEPENDENCY_CYCLE' });
    await assert.rejects(progression.assertAssessmentDependencies(learner.profile.id, target.id, target.unitId), { code: 'PROGRESSION_LOCKED' });
    const correct = question.choices.find((c) => c.isCorrect)!.id, wrong = question.choices.find((c) => !c.isCorrect)!.id;
    await assert.rejects(hw.start(outsider.userId, homework.id), { code: 'ENROLLMENT_REQUIRED' });
    const concurrent = await Promise.all([hw.start(learner.userId, homework.id), hw.start(learner.userId, homework.id)]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    for (let attemptNo = 1; attemptNo <= 3; attemptNo++) {
      const attempt = await hw.start(learner.userId, homework.id);
      assert.equal(attempt.attemptNo, attemptNo);
      await assert.rejects(hw.submit(outsider.userId, homework.id, [], attempt.id), { code: 'ENROLLMENT_REQUIRED' });
      const result = await hw.submit(learner.userId, homework.id, [{ questionId: question.id, selectedChoiceId: wrong }], attempt.id);
      assert.equal(result.passed, false);
      await assert.rejects(hw.submit(learner.userId, homework.id, [], attempt.id), { code: 'ATTEMPT_CLOSED' });
      await assert.rejects(progression.assertCanAccessLesson(learner.userId, target.id), { code: 'PROGRESSION_LOCKED' });
    }
    await assert.rejects(hw.start(learner.userId, homework.id), { code: 'MAX_ATTEMPTS_REACHED' });
    await admin.grant('homework', homework.id, learner.profile.id, owner.userId, 1);
    assert.equal((await hw.getForStudent(learner.userId, homework.id)).maxAttempts, 4);
    await assert.rejects(progression.assertCanAccessLesson(learner.userId, target.id), { code: 'PROGRESSION_LOCKED' });
    const fourth = await hw.start(learner.userId, homework.id);
    const passed = await hw.submit(learner.userId, homework.id, [{ questionId: question.id, selectedChoiceId: correct }], fourth.id);
    assert.equal(passed.passed, true); assert.equal(Number(passed.percentage), 100);
    await progression.assertCanAccessLesson(learner.userId, target.id);
    await progression.assertAssessmentDependencies(learner.profile.id, target.id, target.unitId);
    await app.prisma.courseEnrollment.updateMany({ where: { courseId, studentId: learner.profile.id }, data: { status: 'CANCELLED' } });
    await assert.rejects(progression.assertCanAccessLesson(learner.userId, target.id), { code: 'ENROLLMENT_REQUIRED' });
    await app.prisma.courseEnrollment.updateMany({ where: { courseId, studentId: learner.profile.id }, data: { status: 'ACTIVE' } });
    await assert.rejects(progression.assertCanAccessLesson(outsider.userId, target.id), { code: 'PROGRESSION_LOCKED' });
    await admin.grant('homework', homework.id, learner.profile.id, owner.userId, 2);
    assert.equal((await hw.getForStudent(learner.userId, homework.id)).maxAttempts, 6);
    assert.equal(await app.prisma.homeworkSubmission.count({ where: { homeworkId: homework.id } }), 4);
    await assert.rejects(hw.updateQuestion(question.id, { prompt: 'Changed' }), { code: 'QUESTION_HAS_ANSWERS' });

    const essay = await hw.create({ lessonId: source.id, title: 'Manual essay', passingPercentage: 60 });
    await hw.addQuestion(essay.id, { type: 'LONG_TEXT', prompt: 'Write', points: 10, position: 0 });
    await hw.update(essay.id, { status: 'PUBLISHED' });
    await admin.dependency('homework', essay.id, { lessonId: target.id });
    const essayQ = (await app.prisma.homeworkQuestion.findFirstOrThrow({ where: { homeworkId: essay.id } }));
    const manualAttempt = await hw.start(learner.userId, essay.id);
    const pending = await hw.submit(learner.userId, essay.id, [{ questionId: essayQ.id, textAnswer: 'My answer' }], manualAttempt.id);
    assert.equal(pending.passed, null); assert.equal(pending.reviewStatus, 'PENDING');
    await assert.rejects(progression.assertCanAccessLesson(learner.userId, target.id), { code: 'PROGRESSION_LOCKED' });
    await assert.rejects(hw.review(pending.id, owner.userId, { reviewStatus: 'REVIEWED', marks: [] }), { code: 'REVIEW_INCOMPLETE' });
    const manual = await hw.review(pending.id, owner.userId, { reviewStatus: 'REVIEWED', marks: [{ answerId: pending.answers[0]!.id, points: 6 }] });
    assert.equal(manual.passed, true);
    await assert.rejects(hw.review(pending.id, owner.userId, { reviewStatus: 'REVIEWED', marks: [] }), { code: 'ATTEMPT_CLOSED' });
    const failedAttempt = await hw.start(learner.userId, essay.id);
    const pendingFail = await hw.submit(learner.userId, essay.id, [{ questionId: essayQ.id, textAnswer: 'Other answer' }], failedAttempt.id);
    assert.equal((await hw.review(pendingFail.id, owner.userId, { reviewStatus: 'REVIEWED', marks: [{ answerId: pendingFail.answers[0]!.id, points: 5 }] })).passed, false);

    const exam = await exams.create({ courseId, lessonId: source.id, title: 'Exam regression', passingPercentage: 60, status: 'DRAFT' });
    const section = await exams.addSection(exam.id, { title: 'Questions', position: 0 });
    const examQ = await exams.addQuestion(section.id, { type: 'LONG_TEXT', prompt: 'Explain', points: 5, position: 0 });
    await exams.update(exam.id, { status: 'PUBLISHED' });
    const starts = await Promise.all([exams.start(learner.userId, exam.id), exams.start(learner.userId, exam.id)]);
    assert.equal(starts[0].attempt.id, starts[1].attempt.id);
    await assert.rejects(exams.submit(outsider.userId, starts[0].attempt.id, []), { code: 'ATTEMPT_NOT_FOUND' });
    await assert.rejects(exams.submit(learner.userId, starts[0].attempt.id, [{ questionId: question.id }]), { code: 'INVALID_QUESTION' });
    assert.equal((await exams.submit(learner.userId, starts[0].attempt.id, [{ questionId: examQ.id, textAnswer: 'Essay' }])).passed, null);
    await assert.rejects(exams.submit(learner.userId, starts[0].attempt.id, []), { code: 'ATTEMPT_CLOSED' });
    const response = await app.prisma.examAnswer.findFirstOrThrow({ where: { attemptId: starts[0].attempt.id } });
    assert.equal((await exams.review(starts[0].attempt.id, [{ answerId: response.id, points: 3 }])).passed, true);
    const draft = await hw.create({ lessonId: source.id, title: 'PDF manual draft' });
    const draftOne = await hw.addQuestion(draft.id, { type: 'LONG_TEXT', prompt: 'First', points: 1, position: 0 });
    const draftTwo = await hw.addQuestion(draft.id, { type: 'LONG_TEXT', prompt: 'Second', points: 1, position: 1 });
    await hw.updateQuestion(draftOne.id, { position: 1 });
    assert.equal((await app.prisma.homeworkQuestion.findUniqueOrThrow({ where: { id: draftTwo.id } })).position, 0);
    const asset = await app.prisma.fileAsset.create({ data: { storageProvider: 'local', storageKey: crypto.randomUUID(), originalName: 'source.pdf', mimeType: 'application/pdf', byteSize: 1n, isPublic: false } }); assetId = asset.id;
    const job = await admin.importPdf('homework', draft.id, asset.id, owner.userId);
    assert.equal(job.status, 'UPLOADED'); assert.equal(job.extractedDraft, null);
    assert.match(job.errorMessage ?? '', /يدويًا/);
    assert.equal((await hw.get(draft.id)).status, 'DRAFT');
    const nonStaff = await app.inject({ method: 'GET', url: `/api/v1/admin/assessments/homework/${homework.id}`, headers: learner.headers });
    assert.equal(nonStaff.statusCode, 403);
    assert.doesNotMatch(nonStaff.body, /Prisma|constraint|stack|E:\\/);
  } finally {
    if (courseId) {
      await app.prisma.assessmentAttemptGrant.deleteMany({ where: { OR: [{ homework: { lesson: { unit: { courseId } } } }, { exam: { courseId } }] } });
      await app.prisma.homeworkImportJob.deleteMany({ where: { homework: { lesson: { unit: { courseId } } } } });
      await app.prisma.homeworkSubmission.deleteMany({ where: { homework: { lesson: { unit: { courseId } } } } });
      await app.prisma.examAttempt.deleteMany({ where: { exam: { courseId } } });
      await app.prisma.exam.deleteMany({ where: { courseId } });
      await app.prisma.courseEnrollment.deleteMany({ where: { courseId } });
      await app.prisma.course.delete({ where: { id: courseId } });
    }
    if (assetId) await app.prisma.fileAsset.delete({ where: { id: assetId } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  }
});
}
