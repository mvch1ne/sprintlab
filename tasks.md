# Development Log

## Next Steps

- Rehost docs
- Windows and maybe some antivirus software seems to be treating the software like malware - affecting the installation for some people. How do we build the .exe so that everything checks out, installs and runs smoothly?

- Some users have issues with installation. Need to create a YouTube video walking through the troubleshooting of likely issues.

- Add a zoom and a pan button so people can zoom and move around without the touchpad or mouse scroll.

- Update the docs for the backend. It's still talking about Body with feet instead of wholebody3d model

- Most of the install issue seems to come from the backend server. This is major but should I consider re-writing everything so that we don't use FastAPI but just run the Python script for the pose? How do we get the data to the front-end, then? How do I stream the SSE data? Would this make things faster too? Wait - sockets?

### UI Revamp

- Phase 0: Foundation — ✅ Done. Extracted 7 hooks from Viewport (1575→889 lines), split Telemetry into 5 sub-components (1309→244 lines), split ControlPanel into 6 sub-components (613→257 lines). UIContext deferred to Phase 1.
- Phase 1: Stage-Based Workflow — ✅ Done. Added UIContext (stage, completion, hasVideo), StageBar with 5 workflow stages (Import/Calibrate/Analyse/Measure/Report), completion indicators, auto-advance on video load, stage-aware control dimming in ControlPanel.
- Phase 2: Visual Polish — ✅ Done. Figtree (sans) for UI / TheSansMonoSCd (mono) for data, glassmorphism + backdrop-blur on all panels, per-stage accent colors (sky/amber/violet/emerald/orange), active:scale micro-interactions on buttons, interactive sparklines with hover tooltip + crosshair.
- Phase 3: Multi-Lane Timeline — ✅ Done. Replaced scrubber with 4-lane zoomable timeline (frame ruler, ground contacts, CoM events, speed sparkline). Scroll to zoom, shift+scroll/alt+drag to pan, auto-pan follows playhead, minimap when zoomed. Control section now auto-sizes to content instead of fixed height.
- Phase 4: Command Palette — ✅ Done. Ctrl+K searchable palette (cmdk) with 25+ actions across 6 groups (Navigation, Playback, Tools, Sprint, View, File). CommandContext action registry decouples producers from consumers. Global keyboard shortcuts (Space, arrows, 1-5, C/P/T, [/]). Clickable Ctrl+K badge in Header. Custom thin zinc scrollbar applied app-wide.

- Phase 5: Annotation Layer — Frame-pinned drawing tools (pen, arrow, circle, text) with PNG export for coach-athlete feedback
- Phase 6: Split-View Comparison — Side-by-side or overlay dual-video mode with synced playback and telemetry diff for athlete comparison
- Phase 7: Detachable Panels — Electron-only pop-out windows for telemetry/timeline on secondary monitors

### Code Quality (from full-project review, 2026-03-25)

#### Critical

- [ ] **Add Error Boundaries** — Zero ErrorBoundary components in frontend. Any child throw (pose, FFmpeg, canvas) white-screens the app. Wrap Dashboard and Viewport.
- [ ] **Split VideoContext** — 42 properties on one context causes excessive re-renders on every consumer. Split into VideoMetadata, SprintState, CoMState contexts.
- [ ] **Backend input validation** — `/infer/video` accepts any file with no size limit, no type validation, no MIME check. Add file size cap, extension whitelist, and structured JSON error responses.
- [ ] **Backend error handling** — Global `PoseTracker` init (server.py:23-29) has no try/catch; `cv2.VideoCapture` return not validated; `tracker()` inference unguarded. Add structured error handling throughout.

#### High

- [ ] **Refactor Viewport.tsx** — 30+ imports, 12+ useState, 8+ hooks. Extract domain logic into `usePoseSetup`, `useVideoSetup`, etc. Keep Viewport as thin orchestrator.
- [ ] **Fix StatusBar force-update** — `setInterval(() => forceUpdate(n+1), 1000)` re-renders every second. Extract time display to isolated component or use ref.
- [ ] **Backend: unblock event loop** — `tracker(frame)` is synchronous inside async endpoint (server.py:74). Use `asyncio.to_thread()`.
- [ ] **Pin backend dependencies** — requirements.txt has zero version pins. Pin all, and split test deps (`pytest`, `httpx`) into `requirements-dev.txt`.
- [ ] **Split backend monolith** — All 129 lines of server.py contain model init, routes, video decoding, inference, serialization. Separate into routes, services, config modules.

#### Medium

- [ ] **Consolidate PoseOverlay refs** — 17 separate refs + 17 useEffects to sync props. Replace with single `useLatest(props)` hook.
- [ ] **Extract sparkline downsampling** — Identical logic in JointRow.tsx:20-23 and CoMTab.tsx:40-43. Create shared utility.
- [ ] **Replace `any` casts** — `(window as any).electronAPI` in useFFmpeg.ts, `(import.meta as unknown as ...)` in usePoseLandmarker.ts. Create proper ElectronAPI and ImportMetaEnv type declarations.
- [ ] **Remove suppressed unused vars** — Viewport.tsx:175-176 uses `void ctxSetReactionTime` to suppress lint. Remove the destructured values if unused.
- [ ] **Fix silent error swallowing** — VideoLayer.tsx:207 `video.play().catch(() => {})` discards errors. At minimum log.
- [ ] **Backend: replace print() with logging** — server.py uses `print('Hello')` and `print("✅ Wholebody3d ready")` instead of the logging module.
- [ ] **Restrict CORS** — server.py:15-20 uses `allow_origins=["*"]`. Acceptable for desktop but should be tightened for any network exposure.

#### Low

- [ ] **Add CI test workflow** — Only docs.yml exists. Add workflow running `npm test`, `eslint`, `tsc`, and `pytest` on PRs.
- [ ] **Add Prettier config** — ESLint only, no formatter for consistent style.
- [ ] **Fix version mismatch** — Root package.json is 1.0.0, frontend is 0.0.0.
- [ ] **Clean up serverlessTest/** — 7 experimental scripts with hardcoded paths and unprofessional filenames. Remove or move out of main repo.
- [ ] **Add component & E2E tests** — Only pure math is tested. No React component tests or end-to-end tests.

### Metrics & Accuracy Improvements

Based on limitations-improvement-paths.md — focusing on what's fixable now with existing data.

#### Signal Processing (sprintMath.ts — no UI/backend changes)

- Phase A: Kalman Filter — Replace forward-fill null handling with per-keypoint Kalman filter using confidence scores as observation noise. Eliminates freeze-snap artifacts during occlusion. Improves every downstream metric.
- Phase B1: Savitzky-Golay Smoothing (angular metrics) — Replace double box filter (w=3) with Savitzky-Golay polynomial filter for joint angles, angular velocities, and accelerations. Make window width fps-adaptive. Preserves peak values that the current triangular kernel attenuates.
- Phase B2: CoM Horizontal Velocity Pipeline — CoM horizontal position is monotonically increasing by physics, which changes the optimal approach entirely. Do NOT use Savitzky-Golay here. Pipeline: (1) monotonicity pre-filter — interpolate any frame where x[i] < x[i-1] as a physically impossible artifact; (2) smoothing spline + analytic derivative — fit to cleaned position data and differentiate analytically, avoiding numerical differentiation error entirely; (3) displacement constraint correction — integrate the velocity curve, compute residual against known physical distance D, apply uniform offset so ∫v(t)dt = D exactly. Validated across 2,400 simulated runs; median velocity RMSE 0.045 m/s vs 0.186 m/s for Savitzky-Golay. Also handles direction normalization (L→R or R→L) upstream of all of this. Full implementation with TypeScript and Python in sprint_timing_engineering_spec.md.
- Phase C: Sub-Frame Contact Detection — Fit cubic spline to foot y-trajectory around threshold crossings and solve analytically. Improves contact timing from ~33ms quantization (at 30fps) to ~5–10ms effective resolution.

#### CoM & Spatial Accuracy

- Phase D: Segmental CoM Model — Replace hip-midpoint CoM with mass-weighted segmental model (Dempster/de Levi tables). Pure function on existing keypoint data. Fixes CoM drift during asymmetric limb positions.
- Phase E: Two-Line Perspective Calibration — Add optional second reference line for ground-plane homography. Corrects perspective foreshortening for non-ideal camera angles. Moderate UX change (extra calibration step).

#### New Metrics (computable from existing data)

- Phase F: Core Spatiotemporal Metrics — Stride length, duty factor, contact length & flight distance, per-step acceleration curve, hip separation (scissor) angle, front-side/back-side mechanics ratio, thigh angular velocity at touchdown, arm action ROM.
- Phase G: Proxy Metrics (require body mass input) — Vertical stiffness, braking/propulsion balance, RSI_sprint, horizontal force-velocity profile (acceleration clips only), bilateral asymmetry indices. Label clearly as estimates.
- Phase H: Automated S-MAS Scoring — Map 12 S-MAS items to kinematic thresholds at gait events. Per-stride, per-side scoring with item-level breakdown. Needs threshold calibration against manual scoring.
- Phase I: Kinogram Generation — Composite image of skeleton at evenly-spaced stride intervals or key gait events. Automatic and event-locked modes. Export as standalone image.

#### Full Keypoint Utilisation

- Phase J: 3D Keypoints — Switch metrics engine from 2D to 3D coordinates (already in wire format but discarded). Apply Kalman filter in 3D space. Enables approximate pelvic rotation, arm swing depth, step width.
- Phase K: Detailed Foot Model — Replace 2-point heel/toe with multi-point foot surface from Wholebody3d. Distinguish forefoot/midfoot/rearfoot contact patterns.
- Phase L: Head Stability — Use face/head keypoints for head stability analysis during sprinting.

## Future Work

- Need to be clear about the angular reference and calculation for the hip and other joints. What's positive and what's negative for hip? How do we compute these for accuracy and in a way that make the most sense for biomechanical analysis? Oh wait! Thigh angular velocity is the useful metric, right? From the 'whip from the hip' paper?
- How do we account for multiple figures being detected?
- Play around with det_frequency = 1 in serverlessTest, then try it in a separate branch of the actual codebase and let's see how that affects performance and accuracy.
- Take the codebase for your portfolio website, and turn it into something that reads the information from a database (like something from Firebase) so that we can modify information without having to re-deploy. Then add sprintlab to it. Or better yet, allow me to log in and update things with a rich-text editor. Or use VitePress with GitHub Actions? Ask around for better solutions. We have the capability to build things from scratch now and build impressive stuff. Build from scratch with Three.JS?
