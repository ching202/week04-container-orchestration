// Run concurrently with a rollout. Each request uses a new connection to the Service.
import http from 'node:http';
const base = process.argv[2] || 'http://127.0.0.1:8080';
const seconds = Number(process.argv[3] || 60);
if (!Number.isFinite(seconds) || seconds < 1) throw new Error('Duration must be positive');
const end = Date.now() + seconds * 1000;
let total = 0;
let failures = 0;
const pods = new Set();
while (Date.now() < end) {
  await new Promise((resolve) => {
    let done = false;
    const finish = (error, response, body) => {
      if (done) return;
      done = true;
      total++;
      let data;
      try { if (body) data = JSON.parse(body); } catch { error = 'Invalid JSON'; }
      const ok = !error && response?.statusCode === 200 && Boolean(data?.pod);
      if (!ok) failures++;
      if (data?.pod) pods.add(data.pod);
      console.log(JSON.stringify({ time: new Date().toISOString(), status: response?.statusCode ?? 0, pod: data?.pod ?? null, version: data?.version ?? null, ok, error: error ? String(error) : undefined }));
      resolve();
    };
    const req = http.get(new URL('/metadata', base), { agent: false, timeout: 2000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (part) => { body += part; });
      response.on('end', () => finish(null, response, body));
      response.on('error', (error) => finish(error));
    });
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', (error) => finish(error));
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
}
console.log(JSON.stringify({ summary: true, requests: total, failures, distinctPods: [...pods] }));
process.exitCode = failures ? 1 : 0;
