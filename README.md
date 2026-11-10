# Container Observatory — Week 04

A small Node.js web app for demonstrating container optimization, Kubernetes scaling, rolling updates, and pod replacement. It serves a responsive landing page, `/healthz`, `/readyz`, and `/metadata` (pod/hostname, uptime, release, runtime, UID).

**Verification status:** deployed and tested successfully on November 10, 2026. Scaling from two to three replicas passed. Deleting one pod produced a healthy replacement in 7.516 seconds with 54/54 successful HTTP checks. A rolling pod-template configuration update passed with 162/162 successful HTTP checks, at least three available replicas, and at most four active pods. The app was restored to two healthy replicas on image 1.0.0. The image is 232.38 MiB, five tests passed during its build, and actual containers run as UID 1000. See [the QA report](docs/QA-REPORT.md) and [raw results](evidence/resilience-2026-11-10T23-01-08-084Z/result.json).

**Recording later:** run `recording-demo.cmd` in a normal Windows session for a guided live demonstration. It saves terminal evidence and pauses for your narration; it does not record video. Use [the recording cues](docs/RECORDING-CUES.md) and [submission template](docs/SUBMISSION.md). The webcam/screen video is the remaining student deliverable.

## Architecture

```text
Browser / curl → localhost:8080 → kind node:30080
                                     ↓ NodePort Service
                              web-app Deployment
                              2 pods → scale to 3
                              Node.js on port 8080
```

The `build` stage installs from a lockfile, runs the application tests, and packages only `src/` and `public/`. The runtime starts from the official `node:24.22.2-alpine3.24` image, pinned to a verified multi-platform SHA-256 digest. It excludes this project's tests, build scripts, docs, and package caches. There are no third-party application dependencies, so no application `node_modules` is needed. The final Node base still contains npm and Alpine tools; this is not a distroless image and multi-stage packaging alone does not prove a particular image size.

The image uses the base image's existing `node` account, UID/GID 1000. Kubernetes also enforces non-root execution, a read-only root filesystem, no privilege escalation, dropped capabilities, and the runtime's default seccomp profile. No credentials are required or embedded. Each pod requests 50m CPU / 64Mi memory and is limited to 250m / 128Mi.

Startup and liveness use `/healthz`. Readiness uses `/readyz`. On SIGTERM, readiness becomes 503 while the app keeps serving for five seconds, then drains connections, with a 20-second deadline inside Kubernetes' 30-second grace period. A rollout allows one extra pod and zero unavailable desired replicas. These settings support continuity; the sampling test below verifies observed behavior.

## Prerequisites

- Docker Desktop with the **Linux engine running** (`docker info` must succeed).
- `kubectl`, and [kind](https://kind.sigs.k8s.io/docs/user/quick-start/) on PATH. The supplied configuration uses kind and does not require Docker Desktop's separate Kubernetes feature.
- Node.js 24 for host-side QA scripts. npm is optional for local execution.
- PowerShell for the automated cluster QA script; the basic Docker/kubectl commands also work in other shells.
- A free local TCP port 8080, and enough resources for the local cluster plus four app pods during an update.

Open a terminal **in this repository folder**. Docker Desktop must be running. On the preparation machine, Docker was started through its desktop app and the user ran `deploy.cmd` in a normal Windows session. The agent's sandbox cannot access Docker's named pipe, but can now verify the cluster through kubectl and the application's HTTP endpoints with network access.

## 1. Run and test without Docker (optional)

**Windows deployment shortcut:** double-click `deploy.cmd` in this project folder. It locates the installed Docker and kind executables, builds the image, creates or reuses the `week04` cluster, deploys two replicas, and verifies endpoints and UID 1000. It saves a transcript and measured results in `evidence/`. It must run in your normal Windows session: the preparation agent's sandbox cannot access Docker's named pipe. The launcher applies the repository's declared 1.0.0 release and two replicas, so use it before the later scaling/update demonstration. It does not delete conflicting clusters or stop unrelated services. The `.cmd` wrapper permits this local PowerShell script for that process only; it does not change the machine's execution-policy setting.

```powershell
node --test
node src/server.mjs
```

Open `http://127.0.0.1:8080`. In a second terminal:

```powershell
node scripts/smoke.mjs http://127.0.0.1:8080
```

Stop the host server with Ctrl+C and wait for it to exit before creating the kind cluster, because both use port 8080. On Windows, metadata reports `uid: null`; host execution cannot prove Linux container privilege.

## 2. Build and inspect the image

```powershell
docker info
docker build --progress=plain -t week04-web:1.0.0 .
docker image ls week04-web
docker image inspect week04-web:1.0.0 --format '{{.Id}} {{.Size}} {{.Config.User}}'
docker history week04-web:1.0.0
docker run --rm --read-only --cap-drop=ALL --security-opt=no-new-privileges --entrypoint id week04-web:1.0.0
```

Record the **actual image size in bytes/MiB**, tag, image ID, and UID 1000. Do not substitute the registry's compressed base-layer size for the final local image size. The original `npm cache clean --force` command was replaced with a temporary cache directory and removal to avoid its force warning.

For a standalone process inspection, use a different host port:

```powershell
docker run -d --name week04-inspect --read-only --cap-drop=ALL --security-opt=no-new-privileges --memory=128m --cpus=0.25 -p 127.0.0.1:8081:8080 week04-web:1.0.0
docker top week04-inspect -eo pid,user,args
docker exec week04-inspect id
docker inspect week04-inspect --format '{{.State.Health.Status}}'
docker stop week04-inspect
docker rm week04-inspect
```

Wait for the health status to become `healthy` (up to approximately 20 seconds). `docker top` reports the running process, while image `Config.User` alone reports only intended configuration.

## 3. Create and deploy the local cluster

```powershell
kind create cluster --name week04 --config kind.yaml --wait 120s
kind load docker-image week04-web:1.0.0 --name week04
kubectl --context kind-week04 apply -f k8s/namespace.yaml
kubectl --context kind-week04 apply -f k8s/deployment.yaml -f k8s/service.yaml
kubectl --context kind-week04 -n week04 rollout status deployment/web-app --timeout=120s
kubectl --context kind-week04 -n week04 get pods -o wide
kubectl --context kind-week04 -n week04 get svc web-app
curl.exe -i http://127.0.0.1:8080/healthz
node scripts/smoke.mjs http://127.0.0.1:8080
```

Visit `http://127.0.0.1:8080`. The initial Deployment has **two ready replicas**. On macOS/Linux, use `curl` instead of `curl.exe`. The explicit context confines commands to the assignment cluster.

The kind port mapping sends real Service traffic to NodePort 30080 and binds only to localhost. `kubectl port-forward service/...` selects an individual pod and is unsuitable for demonstrating Service load balancing or surviving replacement of that selected pod. The browser can reuse a connection and show the same pod repeatedly; use the availability script to open fresh connections.

## 4. Run scaling, self-healing, and rolling-update tests

Run the complete automated sequence:

```powershell
node scripts/resilience.mjs
```

On Windows you can also double-click `resilience.cmd`. Start with a healthy two-replica deployment. The script scales to three, checks readiness, deletes one pod, confirms its UID disappears and a healthy replacement has a new UID, then performs a rolling configuration update. It samples real Service traffic with fresh connections throughout pod replacement and rollout. It checks old and new pod names, zero failed requests, at least three available replicas, and at most four active pods. Finally it removes its temporary environment variable and restores the original replica count.

Each run creates `evidence/resilience-<timestamp>/` with raw command output, pod/Deployment snapshots, HTTP samples, rollout state observations, and `result.json`. The saved November 10 run passed all three tests. Zero observed HTTP failures applies to the recorded sampling windows; it is not an unconditional zero-downtime guarantee.

The core commands executed by the test are:

```powershell
kubectl --context kind-week04 -n week04 scale deployment/web-app --replicas=3
kubectl --context kind-week04 -n week04 get pods -o wide
$victim = kubectl --context kind-week04 -n week04 get pods -l app=web-app -o jsonpath='{.items[0].metadata.name}'
kubectl --context kind-week04 -n week04 get pod $victim -o jsonpath='{.metadata.uid}'
kubectl --context kind-week04 -n week04 delete pod $victim
kubectl --context kind-week04 -n week04 get pods -w
```

Stop watching with Ctrl+C after three pods are Ready. Capture the new name/UID. This demonstrates Deployment replacement after application-pod deletion, not recovery from losing the only cluster node. A liveness restart within a pod is a different mechanism.

## 5. Explain the rolling update

The verified demonstration changes the **pod template configuration**, using the same OCI image `week04-web:1.0.0`. Changing `DEMO_REVISION` creates a new Deployment revision and ReplicaSet; new pods pass readiness before old pods retire. It is not an image-version upgrade.

```powershell
kubectl --context kind-week04 -n week04 set env deployment/web-app DEMO_REVISION=demo-2
kubectl --context kind-week04 -n week04 rollout status deployment/web-app --timeout=150s
kubectl --context kind-week04 -n week04 rollout history deployment/web-app
```

Use the automated test above to capture the full availability interval. For a manual demonstration, start `node scripts/availability.mjs http://127.0.0.1:8080 60` in another terminal before changing the template, and confirm it covers the entire update. Extend the duration if needed. Metadata continues to report release 1.0.0; the pod names and Deployment revision change.

Restore the declared configuration and two replicas after a manual demo:

```powershell
kubectl --context kind-week04 -n week04 set env deployment/web-app DEMO_REVISION-
kubectl --context kind-week04 -n week04 rollout status deployment/web-app --timeout=150s
kubectl --context kind-week04 -n week04 scale deployment/web-app --replicas=2
```

## 6. Browser QA and evidence

Open DevTools before reloading. In **Network**, show 200 responses, media types, timing, `/metadata`, and `/healthz`. In **Console**, confirm no uncaught errors. Refresh the dashboard and inspect it at a phone-sized viewport. The UI makes no requests to external fonts, scripts, or CDNs.

Save build logs, image inspection, pod snapshots/UIDs, rollout sampling, and browser screenshots in `evidence/`. Update [QA-REPORT.md](docs/QA-REPORT.md) only from observed results. Never commit kubeconfig, tokens, `.env` files, or registry credentials.

## 7. Tear down

```powershell
kubectl --context kind-week04 delete namespace week04
kind delete cluster --name week04
```

This removes the dedicated local assignment environment. Images remain available for another recording; optionally remove just these tags with `docker image rm week04-web:1.0.0`.

## AI disclosure, audit, and prompt appendix

**Tool:** OpenAI Codex in this chat. The user supplied the complete assignment as the initial request. Its substantive instructions, including the instructor's example prompt, are preserved exactly (LMS grade/attempt/scheduling metadata omitted from the public copy) in [docs/user-request.txt](docs/user-request.txt). Later setup and verification requests are recorded in [PROMPT-LOG.md](docs/PROMPT-LOG.md). The user ran the deployment launcher; the generated code and audit corrections remain attributed to Codex.

The AI generated the app, container and cluster files, tests, documentation, and audit corrections. It correctly supplied multi-stage packaging, manifest-first caching, non-root execution, requests/limits, and probes. Review identified missing immutable image pinning and a hard-coded Deployment version that would mask the release embedded in an updated image. Both were corrected, with original files preserved. See [AUDIT.md](docs/AUDIT.md) for the evidence and limitations. The student must independently review these changes before describing them as their own audit.

## QA checklist summary

- [x] Host application tests: five tests passed.
- [x] Packaged application: seven endpoint checks passed on the host.
- [x] Official base-image manifest and content digest verified.
- [x] YAML syntax, Service selector, and mapped port consistency checked.
- [x] PowerShell QA script parsed without syntax errors.
- [x] Successful Docker build, five in-build tests, and measured image size: 232.38 MiB.
- [x] Running Linux containers verified as UID 1000.
- [x] Containerized endpoints, rendered dashboard, Refresh button, and browser console checked.
- [x] Two replicas deployed and independently confirmed Ready with zero restarts.
- [ ] Full build-output and DevTools Network demonstration recorded for the video.
- [x] Three replicas scaled and confirmed healthy.
- [x] Deleted pod replaced with a new UID.
- [x] Rolling configuration update observed with 162 HTTP samples and zero failures.
- [x] GitHub repository: https://github.com/ching202/week04-container-orchestration.
- [ ] Webcam + screen video recorded, lasting 5–7 minutes.

See [VIDEO-GUIDE.md](docs/VIDEO-GUIDE.md) for a 6:30 recording outline and [SUBMISSION.md](docs/SUBMISSION.md) for the LMS template. The video link remains a placeholder until the student records and uploads it.

## References

- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker base-image pinning](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions)
- [Official Node image tags](https://github.com/docker-library/official-images/blob/master/library/node)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes probe behavior](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
- [kind port mappings and configuration](https://kind.sigs.k8s.io/docs/user/configuration/)
