import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../src/layouts/AdminLayout.tsx');

test('Admin owns its shared style foundations before Admin overrides on direct navigation', () => {
  for (const [name, file] of [
    ['foundationStyles', 'index.css'],
    ['shellStyles', 'shell.css'],
    ['adminStyles', 'admin-app.css'],
  ]) {
    assert.ok(layout.includes(`import ${name} from '@/styles/${file}?inline';`));
    assert.ok(layout.includes(`<style>{${name}}</style>`));
  }
  assert.ok(layout.indexOf('<style>{foundationStyles}</style>') < layout.indexOf('<style>{shellStyles}</style>'));
  assert.ok(layout.indexOf('<style>{shellStyles}</style>') < layout.indexOf('<style>{adminStyles}</style>'));
  assert.match(layout, /data-layout="admin" dir="rtl"/);
  assert.match(layout, /<Container className="ui-workspace">/);
  assert.match(layout, /<Sidebar items=\{adminNavigation\}/);
  assert.match(layout, /<main id="main-content" className="ui-main">/);
  assert.match(layout, /brandTo="\/admin\/"/);
});

test('Admin style ownership excludes Student theme and retains responsive navigation', () => {
  assert.doesNotMatch(layout, /student-(app|experience)\.css|data-student-theme|englishine-student-theme/);
  const admin = read('../src/styles/admin-app.css');
  const shell = read('../src/styles/shell.css');
  assert.match(admin, /@media \(max-width: 63\.99rem\)/);
  assert.match(admin, /@media \(min-width: 64rem\)/);
  assert.match(shell, /\.ui-drawer\s*\{\s*position: fixed/);
  assert.match(admin, /max-inline-size: 1120px/);
  assert.match(admin, /\.ui-nav-row > \.admin-nav-actions\s*\{\s*display: none/);
  assert.doesNotMatch(admin, /\[data-layout='admin'\] \.admin-nav-actions\s*\{\s*display: none/);
  const student = read('../src/layouts/StudentLayout.tsx');
  assert.match(student, /data-student-theme=\{theme\}/);
  assert.doesNotMatch(student, /admin-app\.css/);
});
