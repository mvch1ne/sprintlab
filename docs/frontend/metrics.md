# Metrics Engine

**Files:**
- `frontend/src/components/dashboard/useSprintMetrics.ts` — React hook
- `frontend/src/components/dashboard/sprintMath.ts` — pure math functions

## Design

The metrics engine is split into two layers:

**`sprintMath.ts`** — pure TypeScript functions. No React, no DOM, no imports beyond TypeScript types. This layer can be imported into unit tests, scripts, or any other context without any framework setup.

**`useSprintMetrics`** — a React hook that calls into `sprintMath.ts` and wraps everything in a `useMemo`. It handles the React lifecycle (memoisation, dependency tracking) while delegating all actual computation to the pure layer.

This separation means the math is independently testable. See [Testing](/testing).

## `sprintMath.ts`

### Exported functions

| Function | Signature | Purpose |
|---|---|---|
| `angleDeg` | `(a, b, c, ar, fw, fh) → number` | Interior angle at vertex B |
| `segAngleDeg` | `(p1, p2, ar, fw, fh) → number` | Signed angle from downward vertical |
| `segInclineDeg` | `(p1, p2, ar, fw, fh) → number` | Unsigned inclination from horizontal |
| `smooth` | `(arr, w) → number[]` | Box filter |
| `derivative` | `(arr, fps) → number[]` | Central-difference derivative + smooth |
| `buildSeries` | `(raw, fps) → JointTimeSeries` | Null-fill → smooth → differentiate |

See the [Math Reference](/math) for the equations behind each function.

### `P2` type

```typescript
type P2 = { x: number; y: number };
```

Used throughout the math layer. All points are in inference-frame pixel coordinates before aspect-ratio correction is applied inside each function.

### `JointTimeSeries`

```typescript
interface JointTimeSeries {
  frames: number[];    // identity: [0, 1, 2, ..., N-1]
  angle: number[];     // degrees, smoothed
  velocity: number[];  // deg/s
  accel: number[];     // deg/s²
}
```

## `useSprintMetrics` Hook

### Signature

```typescript
function useSprintMetrics(
  getKeypoints: (frame: number) => Keypoint[],
  totalFrames: number,
  fps: number,
  calibration: CalibrationData | null,
  frameWidth: number,
  frameHeight: number,
  flipH?: boolean,
): SprintMetrics | null
```

Returns `null` if:
- `totalFrames < 2` or `fps <= 0`
- `calibration` is `null` (distances would be meaningless)

### Computation sequence

1. **Build point arrays** — for each of the 17 relevant landmark indices, `col(idx)` maps across all frames, applying the `score ≥ 0.35` threshold and returning `P2 | null` per frame

2. **CoM** — midpoint of left and right hip arrays

3. **Scale operations** — if calibration + frame dimensions are available, creates a `ScaleOps` object with `h`, `hSigned`, and `xy` converters from pixels to metres

4. **Ground contacts** — `detectContacts` is called separately for left and right foot, then merged and sorted by frame

5. **Angular helpers** — three inner lambdas are defined over the closed-over `ar`, `fw`, `fh`:
   - `jA(a, b, c)` — calls `angleDeg` per frame (joint angles)
   - `sA(from, to)` — calls `segAngleDeg` per frame (thigh)
   - `iA(from, to)` — calls `segInclineDeg` per frame (torso, shin)

6. **`buildSeries` calls** — every joint and segment gets a `JointTimeSeries` by calling `buildSeries` on the per-frame angle array

7. **CoM series** — horizontal position, speed, acceleration, and cumulative distance computed inline

### `detectContacts`

```typescript
export function detectContacts(
  heelPts: (P2 | null)[],
  toePts: (P2 | null)[],
  fps: number,
  foot: 'left' | 'right',
  comPts: (P2 | null)[],
  prev: GroundContactEvent[],
  scaleOps: ScaleOps,
  flipH?: boolean,
): GroundContactEvent[]
```

The `prev` parameter is the already-detected contacts of the *other* foot. It is used to compute step length and step frequency, which are defined relative to the previous contact of **either** foot.

The `flipH` flag inverts the sign of the CoM distance for videos where the athlete runs right-to-left.

See [Math Reference — Ground Contact Detection](/math#ground-contact-detection) for the full algorithm.

## Confidence Threshold

```typescript
const SCORE_MIN = 0.35;
```

Keypoints with `score < SCORE_MIN` are returned as `null`. This threshold was chosen empirically: lower values include noisy detections that corrupt angle calculations; higher values cause too many frames to be treated as missing data.
