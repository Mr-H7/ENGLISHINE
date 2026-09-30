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
