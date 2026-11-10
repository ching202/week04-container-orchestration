# Your recording cues — target 6:30

Run `recording-demo.cmd` from the project folder when you are ready. It pauses at each stage, runs real commands, and saves terminal output. It does not activate the webcam or record your video. Rehearse first, then keep your face visible and speak in your own words.

## Before you press Record

- In OBS or your recorder, capture the screen and add your webcam as a small corner overlay that does not cover commands. Enable your microphone and check that its meter moves.
- Make a short test clip and play it back to check face visibility and sound. Then record the assignment separately.
- Close personal tabs and notifications. Open the app, Dockerfile, original Dockerfile, Kubernetes manifest, and this cue sheet.
- Open browser DevTools: Network and Console. Keep the app at two replicas before the demonstration.
- Have `recording-demo.cmd` ready. Aim for 6:30 and finish between 5:00 and 7:00.

## 0:00–1:30 — architecture and AI audit

“My app is Container Observatory, a small Node.js service. A kind cluster runs two replicas, and a NodePort Service makes it available locally on port 8080. The page shows real pod identity and uptime.”

Show the architecture and the two Dockerfile stages. Point out that package manifests are copied before source, the final image runs with UID 1000, and the Kubernetes file supplies CPU/memory limits and three types of probe.

“Codex produced the draft. I reviewed the missing immutable image pin: a version tag can be repointed, so the final Dockerfile also pins the verified digest. Another correction removed a Deployment version override that could hide the version embedded in a future image.”

Only say you reviewed a correction after you have actually read and understood it. Attribute generated implementation and corrections to Codex.

## 1:30–3:00 — build and application

Press Enter in the launcher to build and inspect. Explain the actual output on your screen. The saved rehearsal image measured **232.38 MiB**, but use the number from your own recording if it differs. Show `id` and the running Node process under UID 1000.

Press Enter for health checks. Show `/healthz` and `/readyz` returning 200, then show the dashboard's pod name, uptime, and UID. In DevTools, show successful statuses, response headers and timing, and no uncaught Console errors.

## 3:00–5:15 — live QA

Run the automated resilience sequence from the launcher and narrate each phase while it happens:

- “The desired replica count is now three; all three must become Ready and available.”
- “I am deleting one application pod. The old UID disappears and a new healthy pod replaces it.”
- “Changing `DEMO_REVISION` changes the pod template and creates a new Deployment revision. This is a rolling configuration update using the same image.”
- “The Service is sampled continuously with new connections. The test checks both old and new pod names and reports request failures.”
- “The policy keeps zero desired replicas unavailable and allows one extra active pod. Terminating pods may temporarily exist as well.”

Saved rehearsal results: replacement in **7.516 seconds**, **54/54** successful self-healing HTTP checks, and **162/162** successful rollout HTTP checks. The rollout observed at least **3 available** replicas and at most **4 active** pods. These are the saved rehearsal measurements; narrate the new live measurements when you record.

## 5:15–6:30 — evidence and conclusion

Show the newly saved `evidence/resilience-.../result.json`, then the AI prompt log and QA report.

“Containers make the runtime portable and repeatable, but images still need patching and orchestration needs careful configuration. Requests and limits help manage resources, and probes keep traffic away from pods that are not ready. This local single-node cluster demonstrates pod recovery, not resilience to losing the whole machine.”

Point to teardown instructions. End near 6:30. Upload the finished video, check that the grader can view it, and insert the real link and actual timestamps into `docs/SUBMISSION.md`.
