![Logo](https://github.com/mvch1ne/sprintlab/blob/main/frontend/public/logo.png)
![Demo](https://github.com/mvch1ne/sprintlab/blob/main/frontend/public/demo.gif)

SprintLab is a desktop application I made to help sprinters perform kinematic analysis on their training videos so they can gain insights and improve their performance. It's built with Electron and a React/TypeScript frontend, and coupled with a Python backend built with FastAPI and RTMLib for highly accurate, research-level pose estimation and tracking of body landmarks. The desktop app bundles everything into a single installer — no Python, no server setup, just download and run.

The app lets users upload videos, calibrate real-world distances and compute performance metrics like ground contact times, stride length, joint angles, linear and angular velocities, acceleration, and more — all from just a video.

This project is very personal to me. As an athlete and engineer from Ghana, West Africa, where biomechanics labs are pretty much non-existent, I looked around for a tool to help level the playing field and realized I had to build it myself. SprintLab is open to everyone worldwide, but my major motivation is to help bridge the resource gap in underdeveloped parts of the world, like Africa. I'm excited to see how it helps athletes everywhere.

### [FULL DOCUMENTATION WEBSITE→](https://mvch1ne.github.io/sprintlab/)

### [DEMO VIDEO →](https://youtu.be/4RrcAlu0W9Q)

---

## Table of Contents

- [Download](#download)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Building from Source](#building-from-source)
- [How It Works](#how-it-works)
- [Metrics Reference](#metrics-reference)
- [Testing](#testing)

---

## Download

A pre-built Windows installer is available on the [**Releases page**](https://github.com/mvch1ne/sprintlab/releases).

| Platform | File                                         | Notes                         |
| -------- | -------------------------------------------- | ----------------------------- |
| Windows  | `SprintLab Setup x.x.x.exe` (NSIS installer) | Available on Releases page    |
| macOS    | `SprintLab-x.x.x.dmg`                        | Build from source (see below) |
| Linux    | `SprintLab-x.x.x.AppImage`                   | Build from source (see below) |

> **Windows users:** Right-click the installer and choose **Run as administrator**. Windows SmartScreen may also show a warning because the binary is not code-signed — click **More info → Run anyway** to proceed.

> **Note:** On first launch, SprintLab downloads the ONNX pose-estimation model weights (~70 MB) and caches them locally. An internet connection is required for this one-time download.

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
┌──────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                         │
│                                                              │
│  ┌──────────────────────────────────────┐  ┌─────────────┐  │
│  │  Viewport (orchestrator)             │  │  VideoCtx   │  │
│  │  ┌─────────────────────────────────┐ │  │  (shared    │  │
│  │  │ useVideoPlayback · useZoomPan   │ │  │   state)    │  │
│  │  │ useCalibration · useMeasurements│ │  └──────┬──────┘  │
│  │  │ useSprintMarkers · useCoM       │ │         │         │
│  │  │ useTrimCrop                     │ │         │         │
│  │  └─────────────────────────────────┘ │         │         │
│  └──────────────┬───────────────────────┘         │         │
│                 │                                  │         │
│  ┌──────────────┴───────┐                         │         │
│  │  Telemetry (shell)   │─────────────────────────┘         │
│  │  ContactsTab · CoMTab│                                   │
│  │  JointRow · Sparkline│                                   │
│  └──────────────────────┘                                   │
│                 │                                            │
│      useSprintMetrics (hook)                                 │
│           sprintMath.ts (pure)                               │
│                 │                                            │
│      POST /infer/video  ←→  SSE stream                      │
└─────────────────┼────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│  Backend (FastAPI)                                            │
│                                                              │
│  GET  /health         — readiness probe                      │
│  POST /infer/video    — SSE: progress + keypoint data        │
│                                                              │
│  OpenCV → frame extraction                                   │
│  RTMLib Wholebody3d → 133 keypoints × N frames               │
│  ONNX Runtime → CPU inference                                │
└──────────────────────────────────────────────────────────────┘
```

The frontend never blocks waiting for inference to finish. The backend streams a `progress` SSE event after every frame (frame index, %, FPS, ETA) and a single `result` event at the end containing all frame data. The frontend stores keypoints in a `Map<frameIdx, Keypoint[]>` and computes all metrics in a single `useMemo` pass once the result arrives.

Video trimming, cropping, and export are handled entirely in the browser using FFmpeg.js (WASM) — no video data leaves the device for those operations.

---

## Tech Stack

### Desktop

| Concern   | Library / Tool                           |
| --------- | ---------------------------------------- |
| Shell     | Electron 36                              |
| Packaging | electron-builder (NSIS / DMG / AppImage) |

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
├── electron/
│   ├── main.js                              # Electron main process (window, backend spawn, static server, menu)
│   └── preload.js                           # Context bridge (fullscreen IPC, resource file reader)
│
├── frontend/
│   ├── src/
│   │   ├── hooks/                             # Custom hooks extracted from Viewport
│   │   │   ├── useVideoPlayback.ts            # Video loading, playback state, frame tracking
│   │   │   ├── useZoomPan.ts                  # Viewport zoom/pan transforms
│   │   │   ├── useCalibration.ts              # 2-point scale reference calibration
│   │   │   ├── useMeasurements.ts             # Distance & angle measurement tools
│   │   │   ├── useSprintMarkers.ts            # Sprint markers, manual contacts, merged contacts
│   │   │   ├── useCoM.ts                      # Centre of Mass display & events
│   │   │   └── useTrimCrop.ts                 # Trim & crop panel state
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── viewport/
│   │   │   │   │   ├── PoseEngine/            # Pose detection + skeleton overlay
│   │   │   │   │   ├── CalibrationAndMeasurements/  # Calibration + measurement tools
│   │   │   │   │   ├── TrimAndCrop/           # FFmpeg.js trim/crop UI
│   │   │   │   │   ├── StatusBar/             # Inference progress indicator
│   │   │   │   │   ├── videoUtilities/        # Export + frame helpers
│   │   │   │   │   ├── controls/              # Split control panel sub-components
│   │   │   │   │   │   ├── PlaybackControls.tsx
│   │   │   │   │   │   ├── CalibrationControls.tsx
│   │   │   │   │   │   ├── PoseControls.tsx
│   │   │   │   │   │   ├── SprintControls.tsx
│   │   │   │   │   │   ├── Scrubber.tsx
│   │   │   │   │   │   └── shared.tsx         # IconBtn, Readout, Separator
│   │   │   │   │   ├── Viewport.tsx           # Orchestrator — composes hooks + overlays
│   │   │   │   │   └── ControlPanel.tsx       # Thin layout composing control groups
│   │   │   │   ├── telemetry/
│   │   │   │   │   ├── Telemetry.tsx          # Tab shell — composes sub-components
│   │   │   │   │   ├── Sparkline.tsx          # Reusable SVG sparkline
│   │   │   │   │   ├── SectionHead.tsx        # Sticky section header
│   │   │   │   │   ├── JointRow.tsx           # Joint angle row with sparkline
│   │   │   │   │   ├── ContactsTab.tsx        # Symmetry grid + per-step table
│   │   │   │   │   └── CoMTab.tsx             # Static + flying mode CoM analysis
│   │   │   │   ├── useSprintMetrics.ts        # React hook — metrics computation
│   │   │   │   ├── sprintMath.ts              # Pure math functions (testable, no React)
│   │   │   │   ├── VideoContext.tsx            # Shared video + metrics state
│   │   │   │   └── PoseContext.tsx             # Pose processing status
│   │   │   ├── layout/                        # App shell (Header, Dashboard)
│   │   │   └── ui/                            # Shared UI primitives
│   │   ├── lib/                               # Utility functions
│   │   ├── test/                              # Vitest setup
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vitest.config.ts
│   └── package.json
│
├── backend/
│   ├── server.py                            # FastAPI app — /health + /infer/video
│   ├── requirements.txt
│   ├── SprintLabBackend.spec                # PyInstaller build spec
│   ├── build_backend.sh / .bat             # Backend build scripts
│   ├── pytest.ini
│   └── tests/
│       ├── conftest.py                      # cv2 + rtmlib stubs (no GPU needed)
│       └── test_server.py                   # Endpoint tests
│
├── scripts/
│   └── generate-icons.js                    # Renders SVG logo → 1024×1024 PNG
│
├── build/                                   # Generated icon assets (git-ignored)
├── electron-builder.yml                     # Cross-platform packaging config
├── package.json                             # Root — Electron entry point
├── tasks.md
└── README.md
```

---

## Getting Started

### Desktop App — Development Mode

Run the app with Electron pointing at the Vite dev server (hot reload enabled):

```bash
# Terminal 1 — start the Python backend
cd backend
pip install -r requirements.txt
uvicorn server:app --port 8000 --reload

Shortcut:
cd backend && pip install -r requirements.txt && uvicorn server:app --port 8000 --reload

# Terminal 2 — start Electron + Vite together
npm install        # root (first time only)
npm run electron:dev
```

### Web / Browser Mode

Run without Electron — useful for frontend-only work:

```bash
# Terminal 1
cd backend && uvicorn server:app --reload

# Terminal 2
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173` in a desktop browser.

> On first start the backend downloads ONNX model weights for Wholebody3d (~70 MB). Subsequent starts are fast. The server runs at `http://localhost:8000`.

---

## Building from Source

Produces a self-contained installer with the Python backend bundled — no Python install needed on end-user machines.

### Prerequisites

| Requirement | Version |
| ----------- | ------- |
| Node.js     | ≥ 20    |
| Python      | ≥ 3.10  |
| pip         | latest  |

### Step 1 — Build the Python backend

PyInstaller compiles the FastAPI server and all ML dependencies into a standalone binary.

> **Windows:** Run this step in a **non-administrator** terminal. PyInstaller warns when run as admin and will block it in a future version. Only the packaging step (Step 3) needs Administrator.

```bash
# Windows
cd backend
build_backend.bat

# macOS / Linux
cd backend
chmod +x build_backend.sh && ./build_backend.sh
```

Output:

- **Windows:** `backend/dist/SprintLabBackend.exe`
- **macOS / Linux:** `backend/dist/SprintLabBackend`

> **onnxruntime on Windows:** if PyInstaller misses any DLLs, add them to the `binaries` list in `backend/SprintLabBackend.spec` and rebuild.

> **`uvicorn.run()` is required:** `server.py` must have `if __name__ == "__main__": uvicorn.run(...)` at the bottom — this is what starts the HTTP server inside the packaged binary. Without it the binary loads the models and exits silently. The `uvicorn server:app` CLI used in dev mode bypasses this block so dev is unaffected.

### Step 2 — Generate app icons (first time only)

```bash
npm install       # root, if not already done
npm run electron:icons
```

This renders the SprintLab SVG logo to `build/icon.png` (1024×1024) and generates `.ico` / `.icns` for Windows and macOS.

### Step 3 — Copy FFmpeg WASM files and package

FFmpeg runs locally inside the app (no internet required). Copy the WASM files from the installed package, then build — run as a single chained command:

> **Windows:** Run your terminal **as Administrator**. electron-builder needs symlink privileges for its code-signing tools — without it the NSIS step will fail.

**Windows CMD:**

```
copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.js frontend\public\ffmpeg\ && copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.wasm frontend\public\ffmpeg\ && npm run electron:build
```

**macOS / Linux:**

```bash
cp frontend/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js frontend/public/ffmpeg/ && cp frontend/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm frontend/public/ffmpeg/ && npm run electron:build
```

Output in `dist-electron/`:

| Platform | Output file                                   |
| -------- | --------------------------------------------- |
| Windows  | `SprintLab Setup x.x.x.exe`                   |
| macOS    | `SprintLab-x.x.x.dmg` _(must build on macOS)_ |
| Linux    | `SprintLab-x.x.x.AppImage`                    |

> **Cross-compilation:** macOS `.dmg` can only be produced on a macOS machine. Windows and Linux builds can be produced on any platform with the right toolchain.

### Step 4 — Publish to GitHub Releases

Requires the [GitHub CLI](https://cli.github.com/) (`gh`). Install it if you haven't already:

```bash
# Windows (if winget shows an msstore error, ignore it — use --source winget explicitly)
winget install GitHub.cli --source winget

# macOS
brew install gh

# Linux
sudo apt install gh   # Debian/Ubuntu
```

> **Windows:** After installing, **close and reopen your terminal** so the PATH update takes effect, then run `gh auth login`.

Then authenticate once:

```bash
gh auth login
```

Run this from the project root after the build completes.

**macOS / Linux (bash — backslash line continuation works):**

```bash
gh release create v1.0.0 \
  "dist-electron/SprintLab Setup 1.0.0.exe" \
  --title "SprintLab v1.0.0" \
  --notes "Windows installer. macOS and Linux users: build from source (see README)."
```

**Windows CMD (must be a single line — no backslash continuation):**

```
gh release create v1.0.0 "dist-electron/SprintLab Setup 1.0.0.exe" --title "SprintLab v1.0.0" --notes "Windows installer. macOS and Linux users: build from source (see README)."
```

The installer is attached as a downloadable asset on the [Releases page](https://github.com/mvch1ne/sprintlab/releases). Update the version tag and filename to match your build output.

### Quick test (no installer)

```bash
npm run electron:pack   # fast unpackaged build in dist-electron/
```

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
