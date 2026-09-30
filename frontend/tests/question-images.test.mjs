import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('both assessments render optional protected question images without disturbing answers', () => {
  const flow = source('../src/components/student/StudentExperience.tsx');
  assert.match(flow, /question\.image \? <QuestionImage image=\{question.image\}/);
  assert.match(flow, /AssessmentQuestion question=\{question\}/);
  const image = source('../src/components/assessment/QuestionImage.tsx');
  assert.match(image, /apiBlob\(url\)/);
  assert.match(image, /URL\.revokeObjectURL/);
  assert.match(image, /تعذر تحميل صورة السؤال/);
  assert.doesNotMatch(image, /correctText|isCorrect|originalName/);
});
test('Admin uses the same contextual image authoring for Homework and Exams', () => {
  const workbench = source('../src/components/admin/AssessmentWorkbench.tsx');
  assert.match(workbench, /QuestionImageControls kind=\{kind\}/);
  assert.match(workbench, /إرفاق صورة السؤال/);
  assert.match(workbench, /استبدال صورة السؤال/);
  assert.match(workbench, /إزالة صورة السؤال/);
  const css = source('../src/components/assessment/question-image.css');
  assert.match(css, /max-inline-size: 100%/);
  assert.match(css, /block-size: auto/);
  assert.match(css, /object-fit: contain/);
});
