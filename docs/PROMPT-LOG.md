# AI disclosure and exact prompt log

Date: November 10, 2026. Tool: OpenAI Codex in the desktop chat.

## Actual user input

The initial substantive user input was the attached assignment text, beginning “Assignment: Containerization, Image Optimization, and Orchestration Deployment.” The chat's “My request” field was blank. The assignment instructions are copied verbatim to [user-request.txt](user-request.txt). Only LMS grade, attempt, and scheduling metadata was omitted from this public copy; the original attachment is retained privately. This is the initial prompt source for this project.

The instructor's “Sample Initial Prompt for Students to Copy & Adapt” appears inside that attachment. It was not separately submitted as another prompt in this session. No invented follow-up conversations, student audit discoveries, or manual student edits are included.

## What Codex did

Codex interpreted the assignment as a request to prepare the implementation and supporting deliverables. It selected a dependency-free Node.js application, a multi-stage Docker image, and Kubernetes on kind. It generated all project files, ran host application tests, inspected official documentation and the Docker registry, and revised its initial artifacts after review.

The initial Dockerfile and Deployment are retained under `docs/initial-draft/`. Corrections and their authorship are described in [AUDIT.md](AUDIT.md). The original Dockerfile's missing digest pin and the Deployment's version override were corrected by Codex. The user granted network access when local HTTP tests were initially blocked by the execution sandbox; that is an environment permission, not a new design prompt.

## Verification and student contribution

Do not describe host tests as container or Kubernetes tests. Consult [QA-REPORT.md](QA-REPORT.md) for actual results. The user ran the generated deployment launcher in their Windows session. Its successful build/deployment evidence was then independently checked by Codex through the live Kubernetes API, HTTP endpoints, and browser. Codex then executed scaling, self-healing, and a rolling configuration update against the live cluster and saved their raw evidence. All passed. The student still needs to review the artifacts, record the webcam/screen demonstration, and supply the genuine video URL.

## Exact follow-up user prompts

1. “now what?” — Codex supplied the next setup steps.
2. “Can you get Docker running and install kind for me?” — Codex started Docker Desktop and installed checksum-verified kind v0.33.0. Permanent PATH modification was blocked; a session PATH command was provided.
3. “Can you create the Kubernetes cluster and deploy the app for me now?” — Direct Docker access was blocked by the sandbox. Codex generated and checked the deployment launcher, then handed its execution to the user.
4. “Done. Can you check the saved deployment results and make sure the app is running?” — The user's saved deployment completed successfully. Codex verified two Ready pods, zero restarts, live HTTP 200 responses, non-root metadata, and the working dashboard.

5. “Can you run the scaling, self-healing, and rolling-update tests for me now and save the results?” — Codex ran all three live tests, saved snapshots and HTTP samples, then restored two replicas and the original configuration.
6. “Can we stick to the assignment and getting it to completion as well. With the video recording and stuff” — Codex aligned the documentation with the assignment and prepared a guided recording launcher and timed cues.
7. In response to “Are you ready to record your webcam, microphone, and screen once the tests pass?”, the user selected “Prepare everything; I’ll record later”. No webcam or microphone recording was started.
8. In response to “Which GitHub account or existing repository should hold this assignment? Enter the username or repository URL.”, the user answered “ching202”.

These are actual user messages. No student-authored code corrections or invented prompt exchanges are claimed.
