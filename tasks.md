# Development Log

## Next Steps

- Windows and maybe some antivirus software seems to be treating the software like malware - affecting the installation for some people. How do we build the .exe so that everything checks out, installs and runs smoothly?

- Some users have issues with installation. Need to create a YouTube video walking through the troubleshooting of likely issues.

- Update the docs for the backend. It's still talking about Body with feet instead of wholebody3d model

- Most of the install issue seems to come from the backend server. This is major but should I consider re-writing everything so that we don't use FastAPI but just run the Python script for the pose? How do we get the data to the front-end, then? How do I stream the SSE data? Would this make things faster too? Wait - sockets?

### UI Revamp

- Phase 0: Foundation — ✅ Done. Extracted 7 hooks from Viewport (1575→889 lines), split Telemetry into 5 sub-components (1309→244 lines), split ControlPanel into 6 sub-components (613→257 lines). UIContext deferred to Phase 1.
- Phase 1: Stage-Based Workflow — ✅ Done. Added UIContext (stage, completion, hasVideo), StageBar with 5 workflow stages (Import/Calibrate/Analyse/Measure/Report), completion indicators, auto-advance on video load, stage-aware control dimming in ControlPanel.
- Phase 2: Visual Polish — ✅ Done. Figtree (sans) for UI / TheSansMonoSCd (mono) for data, glassmorphism + backdrop-blur on all panels, per-stage accent colors (sky/amber/violet/emerald/orange), active:scale micro-interactions on buttons, interactive sparklines with hover tooltip + crosshair.
- Phase 3: Multi-Lane Timeline — ✅ Done. Replaced scrubber with 4-lane zoomable timeline (frame ruler, ground contacts, CoM events, speed sparkline). Scroll to zoom, shift+scroll/alt+drag to pan, auto-pan follows playhead, minimap when zoomed. Control section now auto-sizes to content instead of fixed height.

- Phase 4: Command Palette — Ctrl+K searchable action palette with keyboard shortcuts for all major actions (cmdk library)
- Phase 5: Annotation Layer — Frame-pinned drawing tools (pen, arrow, circle, text) with PNG export for coach-athlete feedback
- Phase 6: Split-View Comparison — Side-by-side or overlay dual-video mode with synced playback and telemetry diff for athlete comparison
- Phase 7: Detachable Panels — Electron-only pop-out windows for telemetry/timeline on secondary monitors

### Metrics & Accuracy Improvements

Based on limitations-improvement-paths.md — focusing on what's fixable now with existing data.

#### Signal Processing (sprintMath.ts — no UI/backend changes)

- Phase A: Kalman Filter — Replace forward-fill null handling with per-keypoint Kalman filter using confidence scores as observation noise. Eliminates freeze-snap artifacts during occlusion. Improves every downstream metric.
- Phase B: Savitzky-Golay Smoothing — Replace double box filter (w=3) with Savitzky-Golay polynomial filter. Make window width fps-adaptive. Preserves peak angular velocities/accelerations that the current triangular kernel attenuates.
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
