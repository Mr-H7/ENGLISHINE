import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { deriveNextAction, semanticState } from '../src/features/student/student-learning.ts';

const router = readFileSync(new URL('../src/router/publicRouter.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/pages/student/StudentCatalogPages.tsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/components/student/StudentNavigation.tsx', import.meta.url), 'utf8');
const learning = readFileSync(new URL('../src/features/student/student-learning.ts', import.meta.url), 'utf8');

test('lesson refresh uses lesson authorization, never course activation or redemption', () => {
  const context = readFileSync(new URL('../src/components/student/LessonLearningContext.tsx', import.meta.url), 'utf8');
  assert.match(context, /studentPlatformApi\.lessonRequirements\(lessonId\)/);
  assert.doesNotMatch(context, /studentPlatformApi\.roadmap|\/student\/activation/);
  const activation = readFileSync(new URL('../src/pages/auth/ActivationRedeemPage.tsx', import.meta.url), 'utf8');
  assert.match(activation, /code\.trim\(\)\.length < 8/);
  assert.match(activation, /minLength=\{8\}/);
});

test('Student theme initializes before paint and remains isolated from Admin', () => {
  const layout = readFileSync(new URL('../src/layouts/StudentLayout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /useState<'light' \| 'dark'>\(\(\) =>/);
  assert.match(layout, /localStorage\.getItem\('englishine-student-theme'\)/);
  assert.match(layout, /data-student-theme=\{theme\}/);
  assert.doesNotMatch(layout, /document\.documentElement.*theme/);
  assert.match(navigation, /aria-pressed=\{theme === 'dark'\}/);
});

test('student learning routes include real unit and assessment workspaces', () => {
  for (const path of [
    '/student/courses/:courseId/units/:unitId/',
    '/student/homework/:homeworkId/',
    '/student/exams/:examId/',
    '/student/lesson/:lessonId/',
  ]) {
    assert.match(router, new RegExp(path.replaceAll('/', '\\/').replaceAll(':', '\\:')));
  }
});

test('student shell keeps canonical home and focused mobile navigation', () => {
  assert.match(navigation, /to="\/student\/"/);
  assert.match(navigation, /studentMobileNavigation/);
  assert.match(navigation, /المزيد/);
});

test('next action is derived from persisted progression requirements', () => {
  assert.match(learning, /video:/);
  assert.match(learning, /homework-submit:/);
  assert.match(learning, /homework-review:/);
  assert.match(learning, /exam:/);
  assert.match(learning, /\/student\/lesson\/\$\{lessonState\.lessonId\}/);
});

test('assessment pages submit through real APIs and keep grade read-only', () => {
  assert.match(catalog, /studentPlatformApi\.submitHomework/);
  assert.match(catalog, /studentPlatformApi\.startExam/);
  assert.match(catalog, /studentPlatformApi\.submitExam/);
  assert.match(catalog, /readOnly aria-describedby="grade-help"/);
  assert.doesNotMatch(catalog, /updateGrade\(/);
});

test('student experience contains no approved-design fake metrics or draft actions', () => {
  for (const prohibited of ['96%', '14:20', 'حفظ كمسودة', 'طالب متميز', 'study streak']) {
    assert.equal(catalog.includes(prohibited), false, prohibited);
    assert.equal(learning.includes(prohibited), false, prohibited);
  }
});

test('next action uses the real incomplete requirement and distinguishes access locks', () => {
  const course = { course: { id: 'course', title: 'Course', units: [{ id: 'unit', title: 'Unit', lessons: [{ id: 'lesson', title: 'Lesson' }] }] } };
  const roadmap = [{ unitId: 'unit', entitled: true, state: 'IN_PROGRESS', requirements: [], lessons: [{ lessonId: 'lesson', entitled: true, state: 'IN_PROGRESS', requirements: [{ key: 'homework-submit:homework', complete: false, current: true }] }] }];
  assert.equal(deriveNextAction(course, roadmap, [], []).href, '/student/homework/homework/');
  roadmap[0].lessons[0].requirements[0].key = 'exam:exam';
  assert.equal(deriveNextAction(course, roadmap, [], []).href, '/student/exams/exam/');
  assert.equal(deriveNextAction(course, [], [], []), null);
  assert.equal(semanticState({ entitled: false, state: 'LOCKED' }), 'NOT_ENTITLED');
  assert.equal(semanticState({ entitled: true, state: 'LOCKED' }), 'LOCKED');
});

test('activation-only Next Action stays within entitled scope and retains prerequisites', () => {
  const course = { accessKind: 'ACTIVATION', course: { id: 'course', title: 'Course', units: [{ id: 'unit', title: 'Unit', lessons: [{ id: 'owned', title: 'Owned lesson' }] }] } };
  const row = { unitId: 'unit', entitled: false, contextAccessible: true, state: 'AVAILABLE', requirements: [], lessons: [
    { lessonId: 'sibling', entitled: false, state: 'LOCKED', requirements: [] },
    { lessonId: 'owned', entitled: true, state: 'AVAILABLE', requirements: [{ key: 'video:owned', complete: false, current: true }] },
  ] };
  assert.equal(deriveNextAction(course, [row], [], []).href, '/student/lesson/owned/');
  row.state = 'LOCKED';
  row.lessons[1].state = 'LOCKED';
  assert.equal(deriveNextAction(course, [row], [], []).href, '/student/progress/');
  row.contextAccessible = false;
  assert.equal(deriveNextAction(course, [row], [], []), null);
});

test('homework uses an additive typed choice list and checkbox interaction', () => {
  const components = readFileSync(new URL('../src/components/student/StudentExperience.tsx', import.meta.url), 'utf8');
  assert.match(catalog, /selectedChoiceIds: answer.choiceIds/);
  assert.match(components, /multiple \? 'checkbox' : 'radio'/);
  assert.doesNotMatch(catalog, /unsupported = detail.questions/);
});
