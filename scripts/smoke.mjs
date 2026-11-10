import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8080';
for (const path of ['/', '/style.css', '/app.js', '/favicon.svg', '/healthz', '/readyz', '/metadata']) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, `${path} status`);
  if (path === '/healthz') assert.equal((await response.json()).status, 'ok');
  else if (path === '/readyz') assert.equal((await response.json()).status, 'ready');
  else if (path === '/metadata') {
    const data = await response.json();
    assert.ok(data.hostname && data.pod);
    assert.ok(data.uptimeSeconds >= 0);
    console.log(JSON.stringify({ metadata: data }));
  } else assert.ok((await response.text()).length > 0);
  console.log(JSON.stringify({ path, status: response.status, milliseconds: Math.round(performance.now() - start) }));
}
console.log('PASS: all seven endpoint checks');
