# AI artifact audit

Prepared with Codex on November 10, 2026. This is an AI-assisted review; no student review or manual student correction is claimed.

## Preserved initial output and actual corrections

The files in `initial-draft/` are copies of the actual first generated Dockerfile and Deployment from this session, made before the changes below. They are review evidence and are **not** the files to deploy.

| Finding in the initial artifact | Correction | Verification / implication |
| --- | --- | --- |
| `ARG NODE_IMAGE=node:24.22.2-alpine3.24` pins a version tag but omits an immutable digest. Tags can be repointed. | Added the multi-platform index digest `sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8`. | Fetched the registry manifest and recomputed SHA-256 of its raw body; it matched the registry's `Docker-Content-Digest` header. See `evidence/base-image.json`. This fixes a reproducibility/supply-chain configuration omission, not a demonstrated compromise. |
| Deployment injects `APP_VERSION=1.0.0`, overriding the image's version. A later image release would still report 1.0.0. | Added a runtime-stage `ARG APP_VERSION` and removed the redundant Deployment environment override. | The Docker build argument now embeds the version in the image. The observed rolling configuration update retained image 1.0.0; a different image release was not tested. |
| Builder uses `npm cache clean --force`, which requests a warning-producing force operation. | Use an isolated temporary npm cache and remove it in the same layer. | Static correction. A warning-free Docker build has not yet been observed. |

For the video, explain the first finding as **missing immutable base-image pinning**, show the original and corrected `ARG`, and show the recorded digest. Also explain the version override and why metadata must track the deployed release.

## Runtime follow-up

The image built successfully, passed all five tests during the build, and measured **232.38 MiB**. Saved container status and live metadata confirmed actual UID 1000. Live scaling, pod replacement, and a rolling configuration update all passed; 162 HTTP samples across the rollout had zero failures. See [QA-REPORT.md](QA-REPORT.md). The saved build transcript has the successful build tail, so a complete no-warning build review is reserved for the recording. The table below preserves the original audit plan rather than claiming every suggested inspection was performed.

## Checklist review

| Area | Review result | Runtime evidence still needed |
| --- | --- | --- |
| Multi-stage build | `build` runs tests and packages only runtime files; `runtime` copies the result. | Successful Docker build and image history. |
| Layer ordering | `package.json` and lockfile copied before `npm ci`; source follows. No external dependencies today, so caching benefit is modest. | A source-only rebuild showing the install layer reused. |
| Non-root user | Official Node image supplies UID 1000; final `USER 1000:1000`, matching Kubernetes security context. | `docker top`, `id`, and `kubectl exec ... ps`. |
| Image footprint | Alpine runtime, no app dependencies; no project tests/docs/cache in final app directory. | Measured final image size. No numeric claim made yet. |
| Secrets | No secrets used. Build-context allowlist and `.gitignore` exclude local credentials. Metadata returns selected values, not the complete environment. | Review the final Git diff before publishing. |
| Resources | CPU/memory requests and limits explicitly set for the web container. | Inspect applied Deployment and healthy pods under those limits. |
| Health | Docker healthcheck and Kubernetes startup/liveness/readiness probes present. | Container/Pod health observations. Docker `HEALTHCHECK` is not a replacement for Kubernetes probes. |
| Shutdown | Direct exec-form Node command handles SIGTERM; readiness drains before closing. | Linux signal/rolling-update test; Windows host tests cover readiness behavior, not actual container termination. |
| Update policy | `maxUnavailable: 0`, `maxSurge: 1`, five-second minimum ready period. | Continuous Service traffic across a real update. |
| Additional hardening | Read-only root filesystem, default seccomp, no privilege escalation, drop all capabilities, no service-account token mount. | Confirm the applied Pod spec. |

## Trade-offs and limits

Node's Alpine base is compact relative to a full development image, but larger than a tiny static Go executable. Multi-stage builds help separate build inputs from deployed artifacts; they do not automatically make a dependency-free interpreted app dramatically smaller. The tag and digest must be deliberately refreshed to receive security updates.

Two or three replicas on one kind node demonstrate process/pod resilience, not high availability against node or host failure. CPU limits can cause throttling; memory limits can produce OOM kills if the workload grows. No load test or vulnerability scan was performed. The app has no database or external dependency, so readiness currently means the server is accepting traffic and is not draining.

## Student review to complete

- Read the preserved initial files and final files, and reproduce the evidence commands.
- Describe only corrections you understand and personally reviewed; attribute the generated implementation and corrections to Codex.
- Record any additional changes you make, their exact prompts (if any), and their test results.

Sources: [Docker image pinning](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions), [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/), [Deployment strategy](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).
