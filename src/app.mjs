import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
].map(([path, [name, type]]) => [path, {
  body: readFileSync(new URL(`../public/${name}`, import.meta.url)), type,
}]));

export function createApp({ version = process.env.APP_VERSION || '1.0.0' } = {}) {
  const started = performance.now();
  let draining = false;
  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (code, body, type = 'application/json; charset=utf-8') => {
      const data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
      res.writeHead(code, { 'Content-Type': type, 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, { error: 'Method not allowed' });
    }
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { return send(400, { error: 'Invalid URL' }); }
    if (path === '/healthz') return send(200, { status: 'ok' });
    if (path === '/readyz') return send(draining ? 503 : 200, { status: draining ? 'draining' : 'ready' });
    if (path === '/metadata') return send(200, {
      hostname: hostname(),
      pod: process.env.POD_NAME || hostname(),
      uptimeSeconds: Math.floor((performance.now() - started) / 1000),
      version,
      runtime: process.version,
      uid: process.getuid?.() ?? null,
      ready: !draining,
    });
    const asset = assets.get(path);
    if (asset) return send(200, asset.body, asset.type);
    return send(404, { error: 'Not found' });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 2_000;
  return { server, beginDrain: () => { draining = true; } };
}
