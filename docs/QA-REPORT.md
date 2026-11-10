# QA report

Preparation date: November 10, 2026. Results are explicitly separated by execution environment. Update pending rows only after reproducing the relevant checks.

## Environment setup follow-up

Later on November 10, Docker Desktop was successfully started through its desktop app; the dashboard explicitly reported **Engine running**. kind v0.33.0 was downloaded from the official release, checksum-verified, and its version command succeeded. The agent's sandbox cannot access Docker's named pipe; the user subsequently ran the launcher outside that sandbox and completed the deployment. The original preparation observations below are retained as history.

A subsequent deployment attempt was blocked by the same pipe restriction. The permission tool rejected the pipe path as not representable, so access could not be granted. A Windows launcher (`deploy.cmd` and `scripts/deploy.ps1`) is now provided for the user's normal Windows session. It builds the image, creates or reuses the cluster, deploys two replicas, and saves actual verification results. Launcher syntax and control flow were checked with isolated mocked commands; those checks do not count as a Docker build or cluster deployment. No mock results are included in the project's evidence folder.

## Current deployment verification

The user's deployment completed at **5:46:26 PM America/New_York on November 10, 2026**. Codex then independently checked the live Kubernetes API, HTTP endpoints, and browser dashboard. Raw deployment results are in `evidence/deployment-result-20261110-174441.json`, the transcript in `evidence/deployment-20261110-174441.txt`, and the follow-up summary in `evidence/live-verification-20261110.json`.

| Check | Current result |
| --- | --- |
| Image build | Succeeded; all five tests passed inside the build. The saved transcript contains the successful build tail, not every earlier build line; capture the full build output for the video. |
| Image size and tag | `week04-web:1.0.0`, 243,666,281 bytes / **232.38 MiB**. |
| Cluster and Deployment | `kind-week04`, namespace `week04`, Deployment `web-app`: **2/2 Ready, two up-to-date, two available**. |
| Pods | `web-app-68ff665cfc-m4m8h` and `web-app-68ff665cfc-qkvzz`: Running, Ready, **zero restarts** each. |
| Non-root execution | Saved pod status reports actual Linux UID/GID 1000 for both containers. Launcher checks and live `/metadata` also confirm UID 1000. |
| Endpoints | All seven endpoints passed in the deployment run. Follow-up requests to `/`, `/healthz`, `/readyz`, and `/metadata` independently returned HTTP 200. Health payload: `ok`; readiness: `ready`. |
| Application version | Live metadata reports release **1.0.0**, Node.js **v24.22.2**, a deployed pod name, and increasing uptime. |
| Browser | Dashboard rendered, displayed Ready and UID 1000, and refreshed successfully. It showed one pod before Refresh and the other afterward. No captured console warnings or errors. Phone-layout inspection passed at an observed 414 px viewport with no horizontal overflow; full-page capture is `evidence/browser-mobile.jpg`. The recorded DevTools Network demonstration remains pending. |
| Resilience | **PASS** — scaling, pod replacement, and rolling configuration update completed. See the dated results below. |

## Live resilience tests — November 10, 2026

The later [recording preflight](../evidence/recording-preflight-20261110.json) confirmed two Ready pods with zero restarts and UID 1000. `kubectl exec ... ps -o pid,user,args` showed the running Node server as process 1 under user `node`. The phone layout was visually inspected with no horizontal overflow and no captured console warnings/errors; see [the full-page image](../evidence/browser-mobile.jpg).

The sequence ran from **23:01:08 to 23:02:25 UTC** (6:01–6:02 PM Eastern). [result.json](../evidence/resilience-2026-11-10T23-01-08-084Z/result.json) contains the measurements. Its directory also preserves raw command output, before/after snapshots, HTTP samples, and rollout state observations.

| Check | Observed result |
| --- | --- |
| Scaling | **PASS** — two to three replicas; all three Ready and available. |
| Self-healing | **PASS** — pod `web-app-68ff665cfc-5vfcv` (UID `fdab6814-8071-49d3-b65c-ce6f3dfdf9b7`) was deleted. Replacement `web-app-68ff665cfc-92cvf` (UID `3fb286a5-9ce5-46a8-b7da-6e136afec70e`) was healthy in **7.516 seconds**. |
| Self-healing traffic | **54 requests, zero failures**, 23:01:16.850–23:01:28.229 UTC. |
| Rolling update | **PASS** — `DEMO_REVISION` changed the pod template; Deployment revision **1 → 2**. Both revisions used **week04-web:1.0.0**. This was a configuration rollout, not an image upgrade. |
| Rollout traffic | **162 requests, zero failures**, 23:01:28.441–23:02:03.211 UTC. Old and new pod names both appeared. |
| Rollout capacity | Minimum observed available replicas **3**; maximum active pods **4**, consistent with zero unavailable / one surge. Terminating pods are counted separately. |
| Restoration | Temporary environment variable removed; original image 1.0.0 and **two healthy replicas** restored; final HTTP request returned 200. Initial pod names above are historical and were replaced during this test. |

The HTTP sampler opens a fresh connection for each request, about every 200 ms. Finite sampling can miss shorter failures and does not prove universal zero downtime. This single-node lab demonstrates pod replacement, not node/host-failure recovery. No image 1.1.0 upgrade or load test is claimed.

## Initial preparation results (historical)

| Check | Status | Evidence and scope |
| --- | --- | --- |
| Host application tests | PASS | Five tests, zero failures under Windows Node.js 24.22.1; `evidence/host-tests.tap`. Covers assets, health/readiness while draining, metadata, HEAD/405/404 behavior, and security headers. |
| Packaged app endpoint checks | PASS | Build packaging ran; the packaged app returned 200 on `/`, `/healthz`, `/readyz`, `/metadata`, and all three static assets. See `evidence/host-qa.json`. This ran on the host, not inside an OCI image. |
| Base-image identity | PASS | Official registry index digest independently recomputed and matched its header; `evidence/base-image.json`. This verifies content identity, not absence of vulnerabilities. |
| YAML syntax and wiring | PASS | YAML files parsed; Service selector matches Pod labels and kind's mapped port matches the NodePort. This is not server-side Kubernetes API validation. |
| PowerShell QA script syntax | PASS | PowerShell parser reported no errors. The cluster script was not executed because no cluster was configured. |
| Browser visual/Console QA | NOT VERIFIED | Headless Edge failed to launch inside the sandbox. Endpoint tests do not substitute for rendered-page or DevTools checks. |
| Clean Docker build | BLOCKED | `docker version` found the client but could not connect to the Docker Desktop Linux engine named pipe. |
| Final image size and tag | NOT RUN | Requires successful image build; no final image-size number reported. |
| Running container is non-root | NOT RUN | `USER` and security contexts reviewed, but actual Linux process UID must still be recorded. |
| Two-replica deployment | NOT RUN | `kubectl config current-context` reported that no context was set. |
| Scale to three healthy pods | NOT RUN | Run `scripts/qa-kubernetes.ps1` after deployment. |
| Pod replacement/self-healing | NOT RUN | Script verifies disappearance of the deleted UID and three healthy replicas afterward. |
| Rolling image update | NOT RUN | Run the two-terminal update demonstration and inspect the full availability sample. |
| Webcam/video and publication | NOT DONE | Student recording, GitHub publication, and real URLs remain outstanding. |

## Initial environment notes (historical)

The first host HTTP test attempt failed with sandbox `EACCES` errors. After the user granted network access, all five tests passed. Docker Desktop's startup CLI reported a missing launcher registry key; trying its installed executable did not make the Linux engine available. No container, cluster, or remote repository was created.

The local host runtime is 24.22.1; the Dockerfile specifies 24.22.2. The Docker build reruns the tests using the pinned image, so a future successful build will supply the missing image-runtime verification. Registry manifest retrieval succeeded without a running Docker engine. A `kubectl --dry-run=client` attempt still needed API discovery and failed without a cluster; no API validation pass is claimed.

## Completion checklist and measurements

- [x] Record successful build and date; five tests passed in the build.
- [ ] Capture full build output for the video and review any warnings.
- [x] Record image ID, tag, and final size: 243,666,281 bytes / 232.38 MiB; details in `evidence/image-20261110-174441.json`.
- [x] Record actual process user/UID: 1000 for both containers.
- [x] Capture two initial Ready pods and healthy endpoint responses.
- [x] Scale to three; capture all three Ready.
- [x] Record deleted pod name/UID and a healthy replacement with a new UID.
- [x] Capture rolling configuration update and rollout completion on image 1.0.0.
- [x] Record sampling windows: 54 self-healing and 162 rollout requests, zero failures.
- [x] Browser Refresh works; no captured console warnings or errors.
- [ ] Record DevTools Network responses, headers, and timing in the video.
- [x] Inspect phone layout and save full-page screenshot; no horizontal overflow or captured console warnings/errors.
- [ ] Record video duration and working repository/video URLs.

Keep the original preparation evidence. Add dated cluster evidence files rather than overwriting historical results. A failed test should remain documented with its diagnosis and the later successful rerun, if any.
