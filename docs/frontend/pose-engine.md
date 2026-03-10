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

Renders on a canvas element sized to the video. On each frame change:

1. Clears the canvas
2. Gets keypoints for the current frame via `getPoseKeypoints(frameIdx)`
3. For each connection `[a, b]`: if both keypoints have `score ≥ 0.35`, draws a line
4. For each keypoint with `score ≥ 0.35`, draws a small circle

Point coordinates from the backend are in inference-frame pixels. They are scaled to canvas pixels by:

```typescript
const cx = (kp.x / frameWidth) * canvas.width;
const cy = (kp.y / frameHeight) * canvas.height;
```
