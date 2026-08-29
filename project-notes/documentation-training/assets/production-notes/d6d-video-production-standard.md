# SprintScale CMS — Milestone D6D Video Production Standard

## 1. Scope and Authority
This document defines the canonical technical encoding, layout, visual pacing, privacy, and quality standards for all 52 training screencasts (`SS-D6-V001` through `SS-D6-V052`) across the SprintScale CMS documentation and training programme.

---

## 2. Technical Profile & Encoding Specifications
- **Container Format:** MP4 / WebM container
- **Video Codec:** VP8 / H.264 video stream
- **Resolution:** 1440 × 900 px native desktop viewport (Standard 16:10 aspect ratio)
- **Frame Rate:** 25 – 30 fps progressive scan
- **Audio Policy:** Silent instructional screencasts by default. Zero unwanted microphone background noise, zero system notification sounds, zero copyrighted background music.
- **Pacing Standard:** Deliberate, instructional cadence. Human-readable typing speed (50–100ms per character), minimum 1.5s pause on critical start states, and 2.5s hold on completed outcomes.
- **Naming Rule:** Strictly canonical filenames `SS-D6-VXXX.mp4` under `project-notes/documentation-training/assets/videos/`. No `-final`, `-v2`, `-fixed` variations.

---

## 3. Visual Privacy & Security Guardrails
1. **Zero Real PII:** All recordings must use strictly synthetic training data (`Oakridge Learning Club Ltd`, `Eleanor Vance`, `Marcus Sterling`, `Sarah Jenkins`, `Oliver Jenkins`, `Emma Jenkins`, `Noah Taylor`).
2. **Zero Production Mutation:** Recordings must execute strictly against the isolated Neon training database (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`). Production host (`ep-super-dawn-abuicpc2-pooler`) is strictly forbidden.
3. **Clean Presentation Chrome:** Browser bookmarks, personal extensions, external accounts, operating system notification banners, and terminal secrets must never appear.

---

## 4. Pre-Authentication & Starting State Control
- Recordings of back-office workflows must initialize from a clean, pre-authenticated session state (`storageState: /tmp/auth-owner.json` or role-specific session token).
- The first frame of the video must directly display the target route (e.g. `/dashboard/attendance`, `/dashboard/registrations`, `/dashboard/bookings`) rather than login redirects or loading spinners.

---

## 5. Review Frames & Storyboard Generation
- Every produced video must have exactly 3 representative review frames extracted:
  1. **Phase 1: Starting State** (`SS-D6-VXXX-start.png`) — pristine starting layout after settling.
  2. **Phase 2: Core Action / Interaction** (`SS-D6-VXXX-action.png`) — active modal, input, or dropdown representing the decisive workflow step.
  3. **Phase 3: Completed Outcome** (`SS-D6-VXXX-end.png`) — final updated badge, toast, or submitted screen state prior to video completion.
- **Extraction Methodology:** Timestamps must be determined semantically per video asset based on the actual duration and interaction timing. Fixed global timestamps that exceed the video length are strictly prohibited.
- Review frames are stored in `project-notes/documentation-training/assets/review/d6d-batch-X-frames/` and composited into a multi-row visual review storyboard (`d6d-batch-X-video-contact-sheet.png`).

---

## 6. Immutability & Re-recording Policy
- Certified videos and screenshots are frozen and immutable.
- Targeted re-recording is supported via `--assets=V001,V002` CLI flags to prevent accidental modification of previously certified assets.
- Review contact sheets can be generated independently via `--contact-sheet-only` without re-recording video binaries.
