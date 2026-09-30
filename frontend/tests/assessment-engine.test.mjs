import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { assessmentState } from '../src/features/student/student-learning.ts';

test('assessment states distinguish real pass, pending review, exhaustion and resumable attempts', () => {
  assert.equal(assessmentState({}), 'AVAILABLE');
  assert.equal(assessmentState({ passed: false, remainingAttempts: 2 }), 'FAILED');
  assert.equal(assessmentState({ passed: false, remainingAttempts: 0 }), 'ATTEMPTS_EXHAUSTED');
  assert.equal(assessmentState({ passed: null, pending: true, remainingAttempts: 0 }), 'PENDING_REVIEW');
  assert.equal(assessmentState({ inProgress: true, remainingAttempts: 0 }), 'IN_PROGRESS');
  assert.equal(assessmentState({ passed: true, remainingAttempts: 0 }), 'PASSED');
});

test('student homework uses server-issued attempt IDs and keeps navigator keyboard accessible', () => {
  const catalog = readFileSync(new URL('../src/pages/student/StudentCatalogPages.tsx', import.meta.url), 'utf8');
  const components = readFileSync(new URL('../src/components/student/StudentExperience.tsx', import.meta.url), 'utf8');
  assert.match(catalog, /studentPlatformApi\.startHomework\(homeworkId\)/);
  assert.match(catalog, /submitHomework\(homeworkId, payload, attemptId\)/);
  assert.match(components, /aria-current=\{number === index \? 'step'/);
  assert.match(components, /dir="auto"/);
  assert.doesNotMatch(catalog, /isCorrect|correctText/);
});

test('Admin PDFs remain manual provider-required drafts and explicit publication', () => {
  const admin = readFileSync(new URL('../src/components/admin/AssessmentWorkbench.tsx', import.meta.url), 'utf8');
  assert.match(admin, /استخراج الأسئلة غير متصل بمزوّد/);
  assert.match(admin, /نشر بعد المراجعة/);
  assert.match(admin, /assessment\.status !== 'DRAFT'/);
  assert.match(admin, /reviewStatus: 'REVIEWED'/);
});
