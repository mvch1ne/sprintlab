# Architecture

## System Overview

SprintLab is split into two independent processes — a React single-page app in the browser and a Python FastAPI server running locally. They communicate over HTTP: the frontend POSTs a video file and the backend streams results back as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                             │
│                                                                  │
│  ┌───────────────────────────────────────┐  ┌───────────────┐   │
│  │  Viewport (orchestrator)              │  │  VideoContext  │   │
│  │  ┌──────────────────────────────────┐ │  │  shared state │   │
│  │  │ useVideoPlayback · useZoomPan    │ │  │  + metrics    │   │
│  │  │ useCalibration · useMeasurements │ │  └──────┬────────┘   │
│  │  │ useSprintMarkers · useCoM        │ │         │            │
│  │  │ useTrimCrop                      │ │         │            │
│  │  └──────────────────────────────────┘ │         │            │
│  └───────────────┬───────────────────────┘         │            │
│                  │                                  │            │
│  ┌───────────────┴───────┐                         │            │
│  │  Telemetry (shell)    │─────────────────────────┘            │
│  │  ContactsTab · CoMTab │                                      │
│  │  JointRow · Sparkline │                                      │
│  └───────────────────────┘                                      │
│                  │                                               │
│       useSprintMetrics (hook)                                    │
│            sprintMath.ts (pure)                                  │
│                  │                                               │
│       POST /infer/video  ←→  SSE stream                         │
└──────────────────┼───────────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────────┐
│  Backend (FastAPI, localhost:8000)                                │
│                                                                  │
│  GET  /health          readiness probe                           │
│  POST /infer/video     SSE: progress events + result             │
│                                                                  │
│  OpenCV → frame extraction                                       │
│  RTMLib Wholebody3d → 133 keypoints per frame                    │
│  ONNX Runtime → CPU inference                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Upload → Inference

The user uploads a video. The frontend reads it as a `Blob` and POSTs it to `POST /infer/video`. The backend opens the file with OpenCV and runs every frame through RTMLib's Wholebody3d model.

Two SSE event types are emitted:

| Event type | When             | Payload                                                            |
| ---------- | ---------------- | ------------------------------------------------------------------ |
| `progress` | After each frame | `{ frame, total, pct, fps, elapsed, eta }`                         |
| `result`   | Once, at the end | `{ fps, frame_width, frame_height, total_frames, n_kpts, frames }` |

The frontend shows the `progress` events in a status bar. When the `result` event arrives, keypoints are stored in a `Map<frameIdx, Keypoint[]>` inside `VideoContext`.

### 2. Keypoint Wire Format

Each entry in `result.frames` is a flat `number[]` of length `n_kpts × 6`:

```
[ x0, y0, s0,  x1, y1, s1,  ...  xN, yN, sN,   ← 2D coords + score (n_kpts × 3)
  x0, y0, z0,  x1, y1, z1,  ...  xN, yN, zN ]   ← 3D coords (n_kpts × 3)
```

The frontend splits at index `n_kpts × 3` to recover 2D and 3D arrays separately. SprintLab currently uses only the 2D keypoints for all metric computation.

### 3. Metrics Computation

Once inference finishes, the `useSprintMetrics` hook runs a single `useMemo` pass over all frames. The hook:

1. Extracts per-landmark point arrays using a confidence threshold (`score ≥ 0.35`)
2. Detects ground contact windows for both feet
3. Computes interior joint angles, segment inclinations, and thigh angles for every frame
4. Applies box smoothing and central-difference differentiation to produce velocity and acceleration series
5. Builds the CoM trajectory and integrates speed to get cumulative distance

All pure math lives in [`sprintMath.ts`](/frontend/metrics#sprintmathts) — framework-free TypeScript with no React dependencies.

### 4. Rendering

The Viewport renders multiple canvas overlays stacked on top of the video element:

| Overlay              | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `PoseOverlay`        | Draws the 133-keypoint skeleton on each frame            |
| `CalibrationOverlay` | Interactive line-drawing tool for pixel-to-metre scaling |
| `MeasurementOverlay` | Freehand distance and angle measurements                 |
| `CropOverlay`        | Box selection for video crop                             |

The Telemetry panel is a thin tab shell that reads from `VideoContext` and delegates rendering to sub-components (`ContactsTab`, `CoMTab`, `JointRow`, `Sparkline`). A playhead drawn inside each sparkline tracks the current video frame.

## State Management

SprintLab uses two React Contexts rather than a global state library:

### `VideoContext`

The central store. Holds:

- Video metadata (fps, total frames, frame dimensions)
- Current frame index
- Calibration data (`pixelsPerMeter`, `aspectRatio`)
- Computed `SprintMetrics` (output of `useSprintMetrics`)
- Ground contact events (detected + manually added)
- Sprint markers (start frame, finish frame, mode)

### `PoseContext`

A minimal context for pose processing status: `idle | loading | ready | error`. Used by the Telemetry panel to decide what empty state to display.

### Why two contexts?

`VideoContext` is large — it covers video state, calibration, and metrics all in one place to avoid deeply nested prop drilling. `PoseContext` is kept separate because its state is only relevant to a small number of components and changes at a different lifecycle (only during inference).

## Design Decisions

### SSE instead of WebSockets

Inference is a one-way push: the backend sends data, the frontend only receives. SSE is simpler and more appropriate than WebSockets for this pattern — it uses plain HTTP, works through proxies, and reconnects automatically.

### Client-side video processing

Video trimming, cropping, and export use FFmpeg.js (compiled to WebAssembly). This means no video data is sent to any server for those operations — the entire editing pipeline runs in the browser. This is both faster (no upload round-trip) and more privacy-preserving.

### Pure math layer

All biomechanics computation is extracted into `sprintMath.ts` — a file with zero React dependencies. This makes the math fully unit-testable with Vitest without any DOM or component setup. See the [Math Reference](/math) for the full equations.

### Confidence thresholding

Keypoints with a score below `0.35` are treated as `null`. Null gaps in time series are forward-filled then backward-filled before smoothing, so a briefly occluded joint doesn't break the derivative chain.
