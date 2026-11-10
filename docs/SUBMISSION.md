# Week 04 Hands-On Assignment Submission

**Ready for your video link.** The code, deployment, and resilience evidence are prepared. Record your 5–7 minute screen + webcam walkthrough before submitting.

- **Live Demo URL:** N/A — Local Kubernetes / kind. Use the repository's `evidence/` folder and the video as cluster access evidence. Local address: `http://127.0.0.1:8080` while the cluster is running; this is not a public hosted URL.
- **GitHub Repository:** https://github.com/ching202/week04-container-orchestration
- **Video Demonstration:** [INSERT YOUR ACTUAL UNLISTED OR PUBLIC VIDEO URL]

## Video timestamps

These are planned timestamps; replace them with the actual moments in your uploaded recording.

- 0:00 — Architecture overview and AI artifact audit
- 1:30 — Live build, image size, and non-root process verification
- 2:15 — Apply manifests, open the app, health checks, and browser QA
- 3:00 — Scaling and self-healing
- 4:15 — Rolling configuration update with availability sampling
- 5:15 — QA evidence and AI disclosure
- 5:45 — Trade-offs and conclusion

## Finish the assignment

1. Review the original and corrected Dockerfile and Deployment so you can explain the audit in your own words. Attribute the generated implementation and corrections to Codex.
2. Rehearse with `recording-demo.cmd`, then record your screen, webcam, and microphone together. Use [RECORDING-CUES.md](RECORDING-CUES.md). The launcher runs the real commands and saves terminal output, but does not record video.
3. Play back the final recording: confirm 5:00–7:00 duration, visible face and screen, readable commands, clear sound, build/process checks, DevTools Network/Console, scaling, and pod replacement.
4. Upload the actual video, verify grader access, replace the video placeholder and timestamps above, and submit those links to the LMS.

The saved resilience run passed scaling to three, pod replacement in 7.516 seconds, and a rolling configuration update with zero failed requests in the observed windows. The cluster was restored to two replicas. New recording runs create new evidence rather than overwriting the saved run. No video has been recorded by Codex.
