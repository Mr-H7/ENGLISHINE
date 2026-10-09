import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { transferProgress, uploadFailureMessage } from '../src/services/upload-feedback.ts';

test('upload byte totals use the file size even when browser totals are unknown', () => {
  const size = 125095116;
  assert.deepEqual(transferProgress(0, size), { loaded: 0, total: size });
  assert.deepEqual(transferProgress(size + 1, size), { loaded: size, total: size });
  assert.deepEqual(transferProgress(Number.NaN, size), { loaded: 0, total: size });
});
test('upload errors distinguish stages without exposing infrastructure details', () => {
  assert.match(uploadFailureMessage('preparing', 'INVALID_MIME_TYPE'), /الملف/);
  assert.match(uploadFailureMessage('preparing', 'FORBIDDEN'), /صلاحيات/);
  assert.match(uploadFailureMessage('uploading'), /التخزين/);
  assert.match(uploadFailureMessage('uploading', 'STORAGE_REJECTED'), /رفض التخزين/);
  assert.match(uploadFailureMessage('finalizing'), /ربط الملف/);
  assert.notEqual(uploadFailureMessage('preparing'), uploadFailureMessage('finalizing'));
});
test('Content Studio reveals hierarchy progressively and keeps byte counts LTR', () => {
  const page = readFileSync(new URL('../src/pages/admin/AdminCoursesStudio.tsx', import.meta.url), 'utf8');
  assert.match(page, /<details className="admin-card admin-course-rail" open=\{!details\}/);
  assert.match(page, /<details className="admin-hierarchy-browser" open=\{!lessonDetails\}/);
  assert.match(page, /<bdi dir="ltr">/);
  const api = readFileSync(new URL('../src/services/admin.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(api, /cachedDirectUpload = false/);
  assert.match(api, /transferProgress\(event.loaded, file.size\)/);
});
test('Admin delete controls confirm named content and refresh the course list', () => {
  const editor = readFileSync(new URL('../src/components/admin/ContentStudioActions.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/admin/AdminCoursesStudio.tsx', import.meta.url), 'utf8');
  const homework = readFileSync(new URL('../src/components/admin/HomeworkEditor.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/services/admin.ts', import.meta.url), 'utf8');
  assert.match(editor, /kind === 'course'\) await adminApi\.deleteCourse\(targetId\)/);
  assert.match(editor, /role="alertdialog"/);
  assert.match(editor, /disabled=\{busy\}/);
  assert.match(page, /if \(editor\.kind === 'course'\)/);
  assert.match(page, /await reloadCourses\(\)/);
  assert.match(homework, /confirmQuestionId === question\.id/);
  assert.match(api, /deleteCourse: \(id: string\) => apiRequest<void>\(`/);
});
test('Admin shows the API course-deletion blockers instead of a generic override', () => {
  const client = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/admin-app.css', import.meta.url), 'utf8');
  assert.match(client, /code === 'COURSE_HAS_DEPENDENCIES'/);
  assert.match(client, /useServerMessage \? serverMessage/);
  assert.match(styles, /\.admin-live-status\[role='alert'\][\s\S]*white-space:\s*pre-line/);
});
