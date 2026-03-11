# Pose Engine

**Files:** `frontend/src/components/dashboard/viewport/PoseEngine/`

The Pose Engine connects the frontend to the backend inference server. It handles health polling, video upload, SSE stream parsing, keypoint storage, and skeleton rendering.

## `usePoseLandmarker`

The main hook. Returns a `getPoseKeypoints(frameIdx)` function that the Viewport and metrics engine call per-frame.

### Backend health polling

On mount, the hook polls `GET /health` until the backend responds `{"status": "ok"}`. This handles the cold-start delay when model weights are being loaded. The poll interval is 2 seconds.

### Inference flow

```
usePoseLandmarker
  │
  ├── POST /infer/video (multipart/form-data, video blob)
  │
  ├── SSE stream
  │   ├── event: progress  → { frame, total, pct, fps, elapsed, eta }
  │   │   └── updates PoseContext status + progress bar
  │   │
  │   └── event: result    → { fps, frame_width, frame_height, total_frames, n_kpts, frames }
  │       └── parse keypoints → store in Map<frameIdx, Keypoint[]>
  │
  └── returns getPoseKeypoints(i) → Keypoint[] | []
```

### Keypoint storage

Keypoints are stored in a `Map<number, Keypoint[]>` keyed by frame index. The map is populated once when the `result` SSE event arrives — the entire frame array is parsed in a single pass.

### `getPoseKeypoints(frameIdx)`

Returns the `Keypoint[]` for a given frame, or an empty array if inference hasn't run yet or the frame has no detection. This function is stable across renders (memoised) so it can be passed as a prop without causing unnecessary re-renders.

## Keypoint Indices (MMPose Wholebody3d)

The model outputs 133 keypoints per person. SprintLab uses a subset for biomechanics analysis:

| Index | Landmark | Used for |
|---|---|---|
| 0 | Nose | Torso inclination (CoM → Nose) |
| 5 | Left Shoulder | Hip, shoulder angles |
| 6 | Right Shoulder | Hip, shoulder angles |
| 7 | Left Elbow | Shoulder, elbow angles |
| 8 | Right Elbow | Shoulder, elbow angles |
| 9 | Left Wrist | Elbow, wrist angles |
| 10 | Right Wrist | Elbow, wrist angles |
| 11 | Left Hip | Hip angle, CoM, thigh |
| 12 | Right Hip | Hip angle, CoM, thigh |
| 13 | Left Knee | Knee angle, thigh, shin |
| 14 | Right Knee | Knee angle, thigh, shin |
| 15 | Left Ankle | Knee, ankle angles, shin |
| 16 | Right Ankle | Knee, ankle angles, shin |
| 17 | Left Big Toe | Ankle angle, contact detection |
| 19 | Left Heel | Contact detection |
| 20 | Right Big Toe | Ankle angle, contact detection |
| 22 | Right Heel | Contact detection |
| 23–90 | Face | Visualisation only |
| 91–112 | Left hand | Visualisation only |
| 113–132 | Right hand | Visualisation only |

## `poseConfig.ts`

Defines the connection topology for skeleton rendering and region-based colouring:

| Region | Colour | Keypoints |
|---|---|---|
| Face | Light | 23–90 |
| Upper body | Blue | Shoulders, elbows, wrists |
| Core | Purple | Hip–shoulder connections |
| Lower body | Green | Hips, knees, ankles |
| Hands | Dim | 91–132 |

Connections are defined as `[from, to]` index pairs. The `PoseOverlay` component iterates these pairs and draws lines between the normalised $(x, y)$ positions, scaled to the current canvas dimensions.

## `PoseOverlay`

Renders on a canvas element sized to the video. On each frame change it clears the canvas and draws the pose according to the active `ViewMode`.

### Coordinate mapping

Backend keypoints are in inference-frame pixels. They are mapped to canvas pixels through a letterbox transform that preserves the video's aspect ratio:

```typescript
const lb = letterboxRect(canvasW, canvasH, natW, natH);
const cx = lb.left + kp.x * (lb.width / frameWidth);
const cy = lb.top  + kp.y * (lb.height / frameHeight);
```

### Rendering modes

#### `skeleton` (default line mode)
Iterates `CONNECTIONS` pairs. If both endpoints have `score ≥ SCORE_THRESHOLD (0.43)`, draws a coloured line. Dot radius is 4 px.

#### `body`
Draws filled ellipses per anatomical segment using `ctx.ellipse`. Each ellipse is centred on the segment midpoint, rotated to the segment angle, with half-length `segLen/2 + hw×0.35` and half-width `hw`. Stroke: `rgba(0,0,0,0.75)`, 1.5 px.

| Region | Colour |
|---|---|
| Body / arms | `#3b82f6` (blue) |
| Left leg | `#10b981` (green) |
| Right leg | `#06b6d4` (cyan) |

Depth order: right limbs → torso → left limbs (left is visually in front).

#### `neon`
Same segment geometry as `body`. Each segment is drawn twice:
1. **Outer pass** — `ctx.shadowBlur = 22`, fills the ellipse at 73% opacity
2. **Inner pass** — `ctx.shadowBlur = 8`, fills a smaller concentric ellipse (60% × 40% of outer) at `#ffffffaa` for a bright core

| Region | Colour |
|---|---|
| Body / arms | `#00e5ff` (electric cyan) |
| Left leg | `#b2ff00` (electric lime) |
| Right leg | `#ff00e5` (magenta) |

#### `grad` (gradient cylinders)
After translating to the segment midpoint and rotating to align the segment along the x-axis, a `createLinearGradient(0, -hw, 0, hw)` is created in local space. This makes the gradient **perpendicular to the segment**, producing a cylindrical sheen:

```
stop 0.00 → base color at 33% opacity  (dark edge)
stop 0.30 → full base color
stop 0.48 → highlight color            (bright centre)
stop 0.52 → highlight color
stop 0.70 → full base color
stop 1.00 → base color at 33% opacity  (dark edge)
```

| Region | Base | Highlight |
|---|---|---|
| Body / arms | `#3b82f6` | `#93c5fd` |
| Left leg | `#10b981` | `#6ee7b7` |
| Right leg | `#06b6d4` | `#67e8f9` |

#### `analytics`
Uses the `CONNECTIONS` array (same as `skeleton`) but drawn over the video with thicker strokes (2.5 px) and left/right colour coding. No dark background — `skeletonOnly` stays `false` on `VideoLayer`.

| Side | Line & dot colour |
|---|---|
| Left | `#3b82f6` (blue) |
| Right | `#ef4444` (red) |
| Centre / torso | `rgba(255,255,255,0.85)` (white) |

#### `bio` (biomechanics)
Same as `body` but all half-widths scaled by **1.15×**, stroke width 2.5 px at `rgba(0,0,0,0.85)` for bold black outlines.

| Region | Colour |
|---|---|
| Body / arms | `#f1f5f9` (near-white) |
| Left leg | `#f59e0b` (amber) |
| Right leg | `#38bdf8` (sky blue) |
