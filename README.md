SprintLab is a web application I made to help sprinters perform kinematic analysis on their training videos so they can gain insights and improve their performance. It's a React single-page app built with TypeScript, and coupled with a Python backend built with FastAPI and RTMLib for highly accurate, research-level pose estimation and tracking of body landmarks.

The app lets users upload videos, calibrate real-world distances and compute performance metrics like ground contact times, stride length, joint angles, linear and angular velocities, acceleration, and more — all from just a video.

This project is very personal to me. As an athlete and engineer from Ghana, West Africa, where biomechanics labs are pretty much non-existent, I looked around for a tool to help level the playing field and realized I had to build it myself. SprintLab is open to everyone worldwide, but my major motivation is to help bridge the resource gap in underdeveloped parts of the world, like Africa. I'm excited to see how it helps athletes everywhere.

**[Documentation Website →](https://mvch1ne.github.io/sprintlab/)**

### DEPLOYED WEBSITE COMING SOON

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Metrics Reference](#metrics-reference)
- [Testing](#testing)

---

## Features

- **AI Pose Estimation** — 133-keypoint whole-body pose tracking via RTMLib (MMPose Wholebody3d), streamed from the backend as Server-Sent Events so you see real-time progress as each frame is processed
- **Ground Contact Detection** — Automatic detection of foot touchdown and liftoff events, with contact time, flight time, and step frequency computed per stride. Contacts are editable and can also be placed manually
- **Joint Angle Tracking** — Per-frame interior angles for hip, knee, ankle, shoulder, elbow, and wrist on both sides, plus segment inclinations for torso, thigh, and shin — all smoothed and differentiated to give angular velocity and acceleration
- **Center of Mass Trajectory** — Hip-midpoint displacement, horizontal speed, acceleration, and cumulative distance travelled, all in real-world metres once calibrated
- **Calibration** — Draw a reference line on the video, enter its real-world length, and every pixel measurement is converted to metres
- **Distance and Angle Measurement** — Freehand measurement overlay for any distance or angle visible in the frame
- **Video Trim and Crop** — Cut the video to the exact sprint window and crop to remove irrelevant parts, all in the browser via FFmpeg.js (no upload required)
- **Sprint Timing** — Static (block/standing start) and flying-start timing modes, with reaction time, zone entry/exit markers, and frame-accurate sprint start confirmation
- **Telemetry Panel** — Interactive sparklines for every metric with a playhead that tracks the current video frame, plus a tabbed layout across Steps, Lower body, Upper body, and CoM

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐  ┌─────────────┐  │
│  │   Viewport   │   │  Telemetry   │  │  VideoCtx   │  │
│  │  (overlays,  │   │  (sparklines,│  │  (shared    │  │
│  │  pose, calib)│   │   contacts)  │  │   state)    │  │
│  └──────┬───────┘   └──────┬───────┘  └──────┬──────┘  │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                          │                              │
│              useSprintMetrics (hook)                    │
│                   sprintMath.ts (pure)                  │
│                          │                              │
│              POST /infer/video  ←→  SSE stream          │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Backend (FastAPI)                                      │
│                                                         │
│  GET  /health         — readiness probe                 │
│  POST /infer/video    — SSE: progress + keypoint data   │
│                                                         │
│  OpenCV → frame extraction                              │
│  RTMLib Wholebody3d → 133 keypoints × N frames          │
│  ONNX Runtime → CPU inference                           │
└─────────────────────────────────────────────────────────┘
```

The frontend never blocks waiting for inference to finish. The backend streams a `progress` SSE event after every frame (frame index, %, FPS, ETA) and a single `result` event at the end containing all frame data. The frontend stores keypoints in a `Map<frameIdx, Keypoint[]>` and computes all metrics in a single `useMemo` pass once the result arrives.

Video trimming, cropping, and export are handled entirely in the browser using FFmpeg.js (WASM) — no video data leaves the device for those operations.

---

## Tech Stack

### Frontend

| Concern          | Library / Tool                            |
| ---------------- | ----------------------------------------- |
| Framework        | React 19 + TypeScript 5.9                 |
| Build            | Vite 7                                    |
| Styling          | TailwindCSS 4 + Figtree variable font     |
| UI Components    | Radix UI + Shadcn/ui                      |
| Icons            | Lucide React · Tabler Icons · Huge Icons  |
| Video processing | FFmpeg.js (WASM)                          |
| Testing          | Vitest 3 · jsdom · @testing-library/react |

### Backend

| Concern           | Library / Tool                         |
| ----------------- | -------------------------------------- |
| Framework         | FastAPI (async)                        |
| Pose estimation   | RTMLib — MMPose Wholebody3d (133 kpts) |
| Video I/O         | OpenCV                                 |
| Inference runtime | ONNX Runtime (CPU)                     |
| Testing           | pytest · pytest-asyncio · httpx        |

---

## Project Structure

```
sprintlab/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── viewport/
│   │   │   │   │   ├── PoseEngine/          # Pose detection + skeleton overlay
│   │   │   │   │   ├── CalibrationAndMeasurements/  # Calibration + measurement tools
│   │   │   │   │   ├── TrimAndCrop/         # FFmpeg.js trim/crop UI
│   │   │   │   │   ├── StatusBar/           # Inference progress indicator
│   │   │   │   │   ├── videoUtilities/      # Export + frame helpers
│   │   │   │   │   └── Viewport.tsx         # Central video + overlay orchestrator
│   │   │   │   ├── telemetry/
│   │   │   │   │   └── Telemetry.tsx        # Metrics panel (sparklines + contacts table)
│   │   │   │   ├── useSprintMetrics.ts      # React hook — metrics computation
│   │   │   │   ├── sprintMath.ts            # Pure math functions (testable, no React)
│   │   │   │   ├── VideoContext.tsx          # Shared video + metrics state
│   │   │   │   └── PoseContext.tsx           # Pose processing status
│   │   │   ├── layout/                      # App shell (Header, Dashboard)
│   │   │   └── ui/                          # Shared UI primitives
│   │   ├── lib/                             # Utility functions
│   │   ├── test/                            # Vitest setup
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vitest.config.ts
│   └── package.json
│
├── backend/
│   ├── server.py                            # FastAPI app — /health + /infer/video
│   ├── requirements.txt
│   ├── pytest.ini
│   └── tests/
│       ├── conftest.py                      # cv2 + rtmlib stubs (no GPU needed)
│       └── test_server.py                   # Endpoint tests
│
├── tasks.md
└── README.md
```

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

The first startup downloads ONNX model weights for Wholebody3d. Subsequent starts are fast. The server runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Open it, upload a video, and wait for the backend to finish inference before calibrating and exploring metrics.

> The frontend polls `GET /health` on load. If the backend is still initialising (e.g., downloading models), the status bar will show a waiting state until it responds.

---

## How It Works

### 1. Upload and Inference

Upload an MP4 video. The frontend POSTs it to `POST /infer/video`. The backend opens the file with OpenCV, passes each frame through RTMLib's Wholebody3d model, and streams two types of SSE events:

- **`progress`** — sent after each frame: `{ frame, total, pct, fps, elapsed, eta }`
- **`result`** — sent once at the end: `{ fps, frame_width, frame_height, total_frames, n_kpts, frames }`

Each frame in `frames` is a flat array of `n_kpts × 6` floats: `[x0, y0, s0, x1, y1, s1, ...]` (2D coords + confidence score) followed by `[x0, y0, z0, ...]` (3D coords). The frontend splits at `n_kpts × 3` and stores both.

### 2. Calibration

Draw a line on the video over a known distance (e.g., the sprint lane markings), type in the real length, and the app computes `pixelsPerMeter`. Every distance-based metric — step length, CoM displacement, foot-to-CoM offset — is then reported in metres.

### 3. Metrics Computation

Once inference finishes, `useSprintMetrics` runs a single pass over all frames using the keypoints stored in `VideoContext`. All pure math (angle calculations, smoothing, differentiation) lives in `sprintMath.ts`. The hook:

1. Extracts per-landmark point series for every body part
2. Detects ground contacts by tracking the lowest foot point relative to its vertical range (10% threshold)
3. Computes interior angles at each joint using `angleDeg`
4. Computes segment inclinations (torso, shin) using `segInclineDeg`
5. Computes thigh angle from downward vertical using `segAngleDeg`
6. Applies box smoothing and central-difference differentiation for velocity and acceleration
7. Builds the CoM trajectory and integrates speed to get distance

### 4. Telemetry

The Telemetry panel reads from `VideoContext` and renders sparklines for every metric. A playhead line tracks the current video frame in real time. The Steps tab shows the ground contact events table — rows are selectable and editable, and new contacts can be added manually.

---

## Metrics Reference

### Ground Contacts

| Metric            | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Contact time      | Duration from touchdown to liftoff (s)                                                   |
| Flight time       | Airborne duration before this contact (s)                                                |
| Step length       | Horizontal distance to previous touchdown of either foot (m, requires calibration)       |
| Step frequency    | 1 / step cycle time (Hz)                                                                 |
| Foot–CoM distance | Signed horizontal offset: foot X − hip-midpoint X at touchdown (m, requires calibration) |

### Joint Angles (per frame)

All joint angles are interior angles (0°–180°) at the named vertex.

| Joint    | Vertex   | Arms                     |
| -------- | -------- | ------------------------ |
| Hip      | Hip      | Knee → Hip → Shoulder    |
| Knee     | Knee     | Hip → Knee → Ankle       |
| Ankle    | Ankle    | Knee → Ankle → Toe       |
| Shoulder | Shoulder | Elbow → Shoulder → Hip   |
| Elbow    | Elbow    | Shoulder → Elbow → Wrist |
| Wrist    | Wrist    | Elbow → Wrist → (proxy)  |

### Segment Inclinations (per frame)

| Segment | Convention                                                                         |
| ------- | ---------------------------------------------------------------------------------- |
| Torso   | Inclination from horizontal (90° = perfectly upright, <90° = leaning forward/back) |
| Thigh   | Signed angle from downward vertical (+ = forward of vertical, − = behind)          |
| Shin    | Inclination from horizontal (90° = vertical shin, 0° = horizontal)                 |

### Center of Mass

| Metric       | Description                                  |
| ------------ | -------------------------------------------- |
| Displacement | Horizontal position relative to frame 0 (m)  |
| Speed        | \|horizontal velocity\| (m/s)                |
| Acceleration | d(speed)/dt (m/s²)                           |
| Distance     | Cumulative horizontal distance travelled (m) |

---

## Testing

SprintLab follows a test-driven development approach. Both suites run without a camera, GPU, or ML model files.

### Frontend — Vitest

**Stack:** Vitest 3 · jsdom · @testing-library/react

Pure biomechanics math lives in `sprintMath.ts` — extracted from the React hook specifically so it can be tested without any framework overhead.

| Test file                                  | What it covers                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/sprintMath.test.ts`             | `angleDeg` (right angles, straight lines, symmetry) · `segAngleDeg` (vertical, horizontal, signed direction) · `segInclineDeg` (90°=vertical, 0°=horizontal, always non-negative) · `smooth` (length preservation, identity at w=1, noise reduction) · `derivative` (length, linear signal rate) · `buildSeries` (null filling, frame indexing, all-null safety) |
| `__tests__/sprintMetrics.contacts.test.ts` | Single contact detection · duration floor (< 50 ms rejected) · duration ceiling (> 600 ms rejected) · empty and all-null inputs · stable `foot-contactFrame` ID · calibrated CoM distance via `scaleOps`                                                                                                                                                         |

```bash
cd frontend

npm test            # one-shot (CI)
npm run test:watch  # watch mode
npm run test:ui     # interactive browser UI
```

**Result:** 26 tests across 2 files, all passing.

---

### Backend — pytest

**Stack:** pytest · pytest-asyncio · httpx (ASGI transport)

`backend/tests/conftest.py` registers stubs for `cv2` and `rtmlib` before `server.py` is imported, so tests run in under a second with no model downloads or GPU.

| Test file              | What it covers                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/test_server.py` | `GET /health` returns `{"status": "ok"}` · `POST /infer/video` streams at least one `progress` event and exactly one `result` event · `result.frames` entries have the correct `n_kpts × 6` length · every `progress` event contains `frame`, `total`, `pct`, `fps`, `elapsed`, `eta` |

```bash
cd backend

# Install test deps (first time, or use requirements.txt)
pip install pytest pytest-asyncio httpx

python -m pytest
```

**Result:** 4 tests, all passing.

---

### Running both suites

```bash
cd frontend && npm test
cd backend && python -m pytest
```
