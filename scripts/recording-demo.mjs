import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(resolve(root, 'evidence'), { recursive: true });
const log = resolve(root, 'evidence', `recording-demo-${stamp}.txt`);
const input = createInterface({ input: process.stdin, output: process.stdout });
const say = text => { console.log(text); appendFileSync(log, text + '\n'); };
process.env.DOCKER_CONTEXT = 'desktop-linux';
const dockerBin = resolve(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin');
process.env.PATH = dockerBin + ';' + process.env.PATH;

async function run(program, args) {
  say('\n> ' + program + ' ' + args.join(' '));
  await new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: root, windowsHide: true });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
      process.stdout.write(data); appendFileSync(log, data);
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${program} exited with ${code}`)));
  });
}
const k = (...args) => run('kubectl', ['--context', 'kind-week04', '-n', 'week04', ...args]);

try {
  say('WEEK 04 RECORDING WALKTHROUGH — target duration 6:30');
  say('This launcher runs real commands and saves their output. It does not record video.');
  say('Before starting: open OBS/Loom, enable your webcam and microphone, and capture the screen.');
  say('Arrange Dockerfile, docs/initial-draft/Dockerfile, k8s/deployment.yaml, and http://127.0.0.1:8080/.');
  say('Open browser DevTools. Start at two healthy replicas. Avoid running another test at the same time.');
  await k('get', 'pods', '-l', 'app=web-app', '-o', 'wide');

  await input.question('\nStart recording. Explain architecture and the AI audit. At about 1:30, press Enter for the build. ');
  await run('docker', ['build', '--progress=plain', '-t', 'week04-web:1.0.0', '.']);
  await run('docker', ['image', 'ls', 'week04-web']);
  await run('docker', ['image', 'inspect', 'week04-web:1.0.0', '--format', '{{.Id}} {{.Size}} {{.Config.User}}']);
  await run('docker', ['run', '--rm', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--entrypoint', 'id', 'week04-web:1.0.0']);
  await k('exec', 'deployment/web-app', '--', 'ps', '-o', 'pid,user,args');
  say('Explain the measured size and UID 1000. Identify a cached build honestly if Docker uses its cache.');

  await input.question('\nAt about 2:15, press Enter for deployment and endpoint checks. ');
  await k('apply', '-f', 'k8s/deployment.yaml', '-f', 'k8s/service.yaml');
  await k('rollout', 'status', 'deployment/web-app', '--timeout=150s');
  await k('get', 'deployment', 'web-app');
  await k('get', 'pods', '-l', 'app=web-app', '-o', 'wide');
  await run('curl.exe', ['-i', 'http://127.0.0.1:8080/healthz']);
  await run('curl.exe', ['-i', 'http://127.0.0.1:8080/readyz']);
  await run('curl.exe', ['-s', 'http://127.0.0.1:8080/metadata']);
  say('Show the browser, live pod/uptime/UID, DevTools Network statuses and timing, and Console.');

  await input.question('\nAt about 3:00, press Enter to run scaling, pod replacement, and rolling-update tests live. ');
  await run(process.execPath, [resolve(root, 'scripts/resilience.mjs')]);
  say('The rolling test changes DEMO_REVISION in the pod template. It is a configuration rollout using image 1.0.0.');
  say('Explain the old/new pod UIDs, the HTTP sample totals, readiness, and zero-unavailable/one-surge settings.');
  say('The test restores the original replica count and configuration after collecting evidence.');

  await input.question('\nAt about 5:15, show the saved result.json and AI prompt log, then press Enter. ');
  say('At 5:45: discuss portability/repeatability versus image upkeep, resource sizing, and orchestration complexity.');
  say('Mention that multiple pods on one kind node do not protect against losing the whole host.');
  say('Finish near 6:30. Confirm the final video is between 5:00 and 7:00 with face and screen visible.');
  say(`Terminal evidence: ${log}`);
  say('Upload the video and replace the placeholder in docs/SUBMISSION.md with its actual URL and timestamps.');
} catch (error) {
  say('STOP: ' + error.message);
  say('Investigate the failure before recording a successful-test claim.');
  process.exitCode = 1;
} finally { input.close(); }
