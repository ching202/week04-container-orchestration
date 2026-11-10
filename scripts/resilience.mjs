import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = resolve(root, 'evidence', `resilience-${stamp}`);
mkdirSync(directory, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = (name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n');
const event = value => appendFileSync(resolve(directory, 'commands.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...value }) + '\n');
const result = { startedAt: new Date().toISOString(), context: 'kind-week04', namespace: 'week04', status: 'RUNNING', tests: {} };

async function kube(...args) {
  const command = ['--context', 'kind-week04', '-n', 'week04', ...args];
  return await new Promise((resolve, reject) => {
    const child = spawn('kubectl', command, { windowsHide: true });
    let stdout = '', stderr = '';
    const deadline = setTimeout(() => child.kill(), 200_000);
    child.stdout.on('data', part => { stdout += part; });
    child.stderr.on('data', part => { stderr += part; });
    child.on('error', error => { clearTimeout(deadline); reject(error); });
    child.on('close', code => {
      clearTimeout(deadline);
      event({ command: ['kubectl', ...command], code, stdout, stderr });
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`kubectl ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
    });
  });
}
async function state() {
  const [deployment, pods] = await Promise.all([
    kube('get', 'deployment', 'web-app', '-o', 'json', '--request-timeout=10s'),
    kube('get', 'pods', '-l', 'app=web-app', '-o', 'json', '--request-timeout=10s'),
  ]);
  return { time: new Date().toISOString(), deployment: JSON.parse(deployment), pods: JSON.parse(pods).items };
}
const active = s => s.pods.filter(p => !p.metadata.deletionTimestamp);
const ready = p => p.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
function stable(s, count, absent = []) {
  const d = s.deployment;
  return d.spec.replicas === count && d.status.observedGeneration === d.metadata.generation &&
    d.status.updatedReplicas === count && d.status.availableReplicas === count &&
    active(s).length === count && active(s).every(ready) &&
    s.pods.every(p => !absent.includes(p.metadata.uid));
}
async function waitStable(count, absent = []) {
  const end = Date.now() + 150_000;
  do {
    const s = await state();
    if (stable(s, count, absent)) return s;
    await sleep(1000);
  } while (Date.now() < end);
  throw new Error(`Timed out waiting for ${count} available replicas and removal of old pod UIDs.`);
}

function requestMetadata() {
  const start = performance.now();
  return new Promise(resolve => {
    let settled = false;
    const finish = (error, response, body) => {
      if (settled) return;
      settled = true;
      let data;
      try { if (body) data = JSON.parse(body); } catch { error = 'Invalid JSON'; }
      const ok = !error && response?.statusCode === 200 && Boolean(data?.pod) && data?.uid === 1000;
      resolve({ time: new Date().toISOString(), status: response?.statusCode ?? 0,
        milliseconds: Math.round(performance.now() - start), ok,
        pod: data?.pod ?? null, version: data?.version ?? null,
        error: error ? String(error) : undefined });
    };
    const req = http.get('http://127.0.0.1:8080/metadata', { agent: false, timeout: 2000 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', part => { body += part; });
      response.on('end', () => finish(null, response, body));
      response.on('error', error => finish(error));
    });
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', error => finish(error));
  });
}
function monitor(name) {
  const samples = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const sample = await requestMetadata();
      samples.push(sample);
      appendFileSync(resolve(directory, `${name}-http.jsonl`), JSON.stringify(sample) + '\n');
      await sleep(200);
    }
  })();
  return {
    async stop() {
      running = false;
      await loop;
      return { requests: samples.length, failures: samples.filter(s => !s.ok).length,
        startedAt: samples[0]?.time, endedAt: samples.at(-1)?.time,
        distinctPods: [...new Set(samples.map(s => s.pod).filter(Boolean))] };
    },
  };
}

let initial, liveMonitor, changedReplicas = false, changedTemplate = false;
try {
  initial = await state();
  save('01-before.json', initial);
  assert.ok(initial.deployment.spec.replicas >= 2, 'Start with at least two replicas.');
  assert.ok(stable(initial, initial.deployment.spec.replicas), 'Initial deployment must be healthy and stable.');
  assert.equal(initial.deployment.spec.strategy.type, 'RollingUpdate');
  assert.equal(initial.deployment.spec.strategy.rollingUpdate.maxUnavailable, 0);
  assert.equal(initial.deployment.spec.strategy.rollingUpdate.maxSurge, 1);
  const originalContainer = initial.deployment.spec.template.spec.containers.find(c => c.name === 'web');
  assert.ok(originalContainer, 'Expected web container.');
  assert.ok(!originalContainer.env?.some(e => e.name === 'DEMO_REVISION'), 'DEMO_REVISION is reserved for this test and must initially be absent.');
  assert.ok((await requestMetadata()).ok, 'Initial Service HTTP request must pass.');

  console.log('SCALING: increasing desired replicas to 3.');
  changedReplicas = true;
  await kube('scale', 'deployment/web-app', '--replicas=3');
  const scaled = await waitStable(3);
  save('02-scaled.json', scaled);
  result.tests.scaling = { status: 'PASS', initialReplicas: initial.deployment.spec.replicas,
    finalReplicas: 3, pods: active(scaled).map(p => ({ name: p.metadata.name, uid: p.metadata.uid, ready: ready(p) })) };
  console.log(await kube('get', 'pods', '-l', 'app=web-app', '-o', 'wide'));
  console.log('PASS: three pods are Ready and available.');

  console.log('SELF-HEALING: deleting one application pod.');
  const victim = active(scaled)[0];
  console.log(`kubectl delete pod ${victim.metadata.name} (UID ${victim.metadata.uid})`);
  const oldUids = new Set(scaled.pods.map(p => p.metadata.uid));
  liveMonitor = monitor('self-healing');
  await sleep(2000);
  const deletedAt = new Date().toISOString();
  const healStart = performance.now();
  await kube('delete', 'pod', victim.metadata.name, '--wait=false');
  const healed = await waitStable(3, [victim.metadata.uid]);
  const recoveryMilliseconds = Math.round(performance.now() - healStart);
  save('03-healed.json', healed);
  const replacements = active(healed).filter(p => !oldUids.has(p.metadata.uid));
  assert.equal(replacements.length, 1, 'Exactly one replacement pod must have a new UID.');
  console.log(`Replacement: ${replacements[0].metadata.name} (UID ${replacements[0].metadata.uid})`);
  console.log(await kube('get', 'pods', '-l', 'app=web-app', '-o', 'wide'));
  await sleep(2000);
  const healingHttp = await liveMonitor.stop(); liveMonitor = null;
  result.tests.selfHealing = { status: 'PASS', deletedAt, recoveryMilliseconds,
    deletedPod: { name: victim.metadata.name, uid: victim.metadata.uid },
    replacementPod: { name: replacements[0].metadata.name, uid: replacements[0].metadata.uid },
    readyReplicas: 3, http: healingHttp };
  assert.equal(healingHttp.failures, 0, 'HTTP failures occurred during pod replacement.');
  console.log(`PASS: deleted UID disappeared; new pod is healthy (${recoveryMilliseconds} ms). HTTP ${healingHttp.requests} requests, ${healingHttp.failures} failures.`);

  console.log('ROLLING UPDATE: changing DEMO_REVISION in the pod template; image remains unchanged.');
  const oldNames = new Set(active(healed).map(p => p.metadata.name));
  const beforeRevision = healed.deployment.metadata.annotations['deployment.kubernetes.io/revision'];
  const marker = `qa-${stamp}`;
  const rolloutObservations = [];
  let observing = true;
  liveMonitor = monitor('rolling-update');
  await sleep(2000);
  const observer = (async () => {
    while (observing) {
      try {
        const s = await state();
        const item = { time: s.time, available: s.deployment.status.availableReplicas ?? 0,
          updated: s.deployment.status.updatedReplicas ?? 0, activePods: active(s).length,
          terminatingPods: s.pods.length - active(s).length };
        rolloutObservations.push(item);
        if (rolloutObservations.length === 1 || rolloutObservations.at(-2).updated !== item.updated) {
          console.log(`Rollout: ${item.updated} updated, ${item.available} available, ${item.activePods} active pods.`);
        }
        appendFileSync(resolve(directory, 'rolling-update-state.jsonl'), JSON.stringify(item) + '\n');
      } catch (error) { event({ observerError: String(error) }); }
      await sleep(1000);
    }
  })();
  let rolled;
  const rolloutStartedAt = new Date().toISOString();
  try {
    changedTemplate = true;
    await kube('set', 'env', 'deployment/web-app', `DEMO_REVISION=${marker}`);
    await kube('rollout', 'status', 'deployment/web-app', '--timeout=150s');
    rolled = await waitStable(3, active(healed).map(p => p.metadata.uid));
    await sleep(5000);
  } finally { observing = false; await observer; }
  save('04-rolled.json', rolled);
  console.log(await kube('get', 'pods', '-l', 'app=web-app', '-o', 'wide'));
  const rollingHttp = await liveMonitor.stop(); liveMonitor = null;
  const newNames = new Set(active(rolled).map(p => p.metadata.name));
  const afterRevision = rolled.deployment.metadata.annotations['deployment.kubernetes.io/revision'];
  const updatedContainer = rolled.deployment.spec.template.spec.containers.find(c => c.name === 'web');
  result.tests.rollingUpdate = { status: 'PASS', type: 'Pod-template configuration update; same OCI image',
    rolloutStartedAt, completedAt: rolled.time, environmentChange: { name: 'DEMO_REVISION', value: marker },
    beforeRevision, afterRevision, imageBefore: originalContainer.image, imageAfter: updatedContainer.image,
    oldPods: [...oldNames], newPods: [...newNames], http: rollingHttp,
    minimumObservedAvailableReplicas: Math.min(...rolloutObservations.map(o => o.available)),
    maximumObservedActivePods: Math.max(...rolloutObservations.map(o => o.activePods)) };
  assert.notEqual(beforeRevision, afterRevision);
  assert.equal(updatedContainer.image, originalContainer.image);
  assert.equal(updatedContainer.env.find(e => e.name === 'DEMO_REVISION')?.value, marker);
  assert.equal(rollingHttp.failures, 0, 'HTTP failures occurred during rolling update.');
  assert.ok(rollingHttp.distinctPods.some(p => oldNames.has(p)), 'Sampler must observe old pods.');
  assert.ok(rollingHttp.distinctPods.some(p => newNames.has(p)), 'Sampler must observe new pods.');
  assert.ok(rolloutObservations.length > 0, 'State observations must be captured.');
  assert.ok(result.tests.rollingUpdate.minimumObservedAvailableReplicas >= 3);
  assert.ok(result.tests.rollingUpdate.maximumObservedActivePods <= 4);
  console.log(`PASS: revision ${beforeRevision} -> ${afterRevision}; HTTP ${rollingHttp.requests} requests, ${rollingHttp.failures} failures.`);
  console.log('RESTORING: returning the deployment to its original configuration and replica count for recording.');
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL';
  result.error = String(error);
  console.error(error);
} finally {
  if (liveMonitor) result.interruptedMonitor = await liveMonitor.stop();
  try {
    if (changedTemplate) {
      await kube('set', 'env', 'deployment/web-app', 'DEMO_REVISION-');
      await kube('rollout', 'status', 'deployment/web-app', '--timeout=150s');
    }
    if (changedReplicas) await kube('scale', 'deployment/web-app', `--replicas=${initial.deployment.spec.replicas}`);
    if (initial && (changedTemplate || changedReplicas)) {
      const restored = await waitStable(initial.deployment.spec.replicas);
      save('05-restored.json', restored);
      const metadata = await requestMetadata();
      assert.ok(metadata.ok, 'Final HTTP check must pass.');
      result.restored = { readyReplicas: active(restored).length, image: restored.deployment.spec.template.spec.containers.find(c => c.name === 'web').image, http: metadata };
    }
  } catch (error) { result.status = 'FAIL'; result.restorationError = String(error); }
  result.finishedAt = new Date().toISOString();
  save('result.json', result);
  console.log(`RESULT: ${result.status}. Evidence: ${relative(root, directory)}`);
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}
