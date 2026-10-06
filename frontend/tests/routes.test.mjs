import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import {
  routes,
  platformNavigation,
  adminNavigation,
} from '../src/router/manifest.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('all 30 legacy HTML pages remain mapped and unique', () => {
  const actual = [];
  const visit = (dir, prefix = '') => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (
        [
          '.git',
          '.openai',
          '.claude',
          'dist',
          'frontend',
          'node_modules',
        ].includes(item.name)
      )
        continue;
      const rel = prefix + item.name;
      if (item.isDirectory()) visit(dir + '/' + item.name, rel + '/');
      else if (item.name.endsWith('.html')) actual.push(rel);
    }
  };
  visit(root);
  assert.equal(routes.length, 30);
  assert.equal(new Set(routes.map((r) => r.path)).size, routes.length);
  assert.deepEqual(routes.map((r) => r.source).sort(), actual.sort());
  for (const route of routes)
    assert.ok(existsSync(root + route.source), route.source);
});
const routerSource = readFileSync(
  new URL('../src/router/publicRouter.tsx', import.meta.url),
  'utf8',
);
const reactPaths = [...routerSource.matchAll(/path:\s*'([^']+)'/g)].map(
  (match) => match[1],
);
test('shell links target only registered existing routes', () => {
  const paths = new Set([...routes.map((r) => r.path), ...reactPaths]);
  for (const item of [...platformNavigation, ...adminNavigation])
    assert.ok(paths.has(item.href), item.href);
});
test('activation aliases and combined lesson source remain registered', () => {
  assert.ok(routes.some((r) => r.path === '/activation/'));
  assert.ok(routes.some((r) => r.path === '/account/activation/'));
  assert.ok(routes.some((r) => r.path === '/lesson/'));
});
test('public routes are not shadowed by trailing-slash self redirects', () => {
  const canonical = ['/', '/about', '/contact', '/login/', '/signup/'];
  for (const path of canonical) assert.ok(reactPaths.includes(path), path);
  const aliases = routerSource.match(/const studentRouteAliases = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  const normalized = (path) => path.replace(/\/+$/, '') || '/';
  for (const path of canonical) {
    const equivalentAlias = [...aliases.matchAll(/path:\s*'([^']+)'/g)]
      .map((match) => match[1])
      .find((alias) => normalized(alias) === normalized(path));
    assert.equal(equivalentAlias, undefined, `${path} has a competing redirect`);
  }
});
