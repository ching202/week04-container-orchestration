# 6:30 screen + webcam walkthrough

Keep your face visible throughout, with clear audio. Use these as speaking cues, not a verbatim script. Rehearse once; the submission must be between 5:00 and 7:00. Use only claims you verified yourself.

Before recording: start Docker, create the cluster, run the full QA once, and arrange your editor, browser DevTools, and a terminal. Run `recording-demo.cmd` for the guided sequence; see [RECORDING-CUES.md](RECORDING-CUES.md). Leave the cluster at image 1.0.0 and two replicas. A cached build is fine if you identify it as cached; never relabel prior output as a fresh successful build.

| Time | Screen action | Speaking cues |
| --- | --- | --- |
| 0:00–0:35 | Show the landing page and README architecture. | A stateless Node app; localhost maps through kind's NodePort Service to two pods. Hostname and uptime are live values. One node is a local lab, not host-failure high availability. |
| 0:35–1:30 | Show initial and final Dockerfile, then Deployment. | Codex generated the first draft. Review caught missing immutable image pinning: a version tag can move, so the final image also pins a verified SHA-256 digest. Explain build/runtime stages, UID 1000, manifest-first install, resource constraints, readiness and liveness. Mention that the version override was removed so updated images report their own release. |
| 1:30–2:15 | Run the build; show image size and running process inspection. | Explain measured size from your output. Show `Config.User`, `kubectl exec ... ps`, and `id`; distinguish configuration from actual execution. Never quote an unmeasured image size. |
| 2:15–3:00 | Show two Ready pods and open the app. | Point to the live pod name, uptime, version, and UID. Open `/healthz`, `/readyz`, and `/metadata`. Show Network statuses/timing and an empty Console. |
| 3:00–3:35 | Scale to three and wait for readiness. | Desired state changes to three; scheduling alone is not readiness. Show all three Ready. |
| 3:35–4:15 | Delete one pod; watch replacement. | Capture the old name/UID and the new one. The Deployment's ReplicaSet restores the replica count. This is pod replacement, not loss of a cluster node. |
| 4:15–5:15 | Watch the automated rolling configuration update and its HTTP sampler. | Changing `DEMO_REVISION` changes the pod template while retaining image 1.0.0. New pods pass readiness before old pods retire. Explain zero unavailable / one surge and graceful shutdown. Show the sample summary and distinct old/new pods. Report any failed requests honestly. |
| 5:15–5:45 | Review QA evidence and AI prompt appendix. | Show saved logs and completed checks. Attribute generated work and discuss your own review. |
| 5:45–6:30 | Return to architecture and camera. | Portability and repeatable builds help deployment, while image patching, orchestration configuration, resource sizing, and debugging add operational work. Local replicas do not protect against host failure. Point to teardown commands and close. |

Use the exact README commands. If a rollout is too slow for the timing, fix the issue and rehearse again; keep the required live proof in the final recording.

After recording, upload the actual video, confirm the link is viewable by the grader, and replace the planned timestamps in `SUBMISSION.md` with the real timestamps.
