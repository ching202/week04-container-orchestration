import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';

async function fixture(t, options) {
  const app = createApp(options);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise((resolve) => app.server.close(resolve)));
  return { ...app, url: `http://127.0.0.1:${app.server.address().port}` };
}

test('landing page and every linked asset are served with correct media types', async (t) => {
  const { url } = await fixture(t);
  for (const [path, type] of [['/', 'text/html'], ['/style.css', 'text/css'], ['/app.js', 'text/javascript'], ['/favicon.svg', 'image/svg+xml']]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.ok((await response.text()).length > 0);
  }
});

test('health and readiness are distinct during graceful draining', async (t) => {
  const { url, beginDrain } = await fixture(t);
  assert.equal((await fetch(url + '/readyz')).status, 200);
  beginDrain();
  const ready = await fetch(url + '/readyz');
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: 'draining' });
  const health = await fetch(url + '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await fetch(url + '/')).status, 200);
});

test('metadata reports actual host identity, uptime, and configured release', async (t) => {
  const { url } = await fixture(t, { version: '2.0.0-test' });
  const response = await fetch(url + '/metadata');
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.version, '2.0.0-test');
  assert.equal(data.runtime, process.version);
  assert.equal(data.uid, process.getuid?.() ?? null);
  assert.ok(data.hostname.length > 0 && data.pod.length > 0);
  assert.ok(data.uptimeSeconds >= 0);
  assert.equal(data.ready, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal('env' in data, false);
});

test('HEAD works without a body; unsupported methods and paths are rejected', async (t) => {
  const { url } = await fixture(t);
  const head = await fetch(url + '/healthz', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await fetch(url + '/healthz', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  for (const path of ['/missing', '/.env', '/package.json', '/src/server.mjs']) {
    assert.equal((await fetch(url + path)).status, 404);
  }
});

test('security headers permit local assets and forbid embedded frames and objects', async (t) => {
  const { url } = await fixture(t);
  const response = await fetch(url);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
