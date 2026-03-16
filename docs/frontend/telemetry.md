# Telemetry Panel

**File:** `frontend/src/components/dashboard/telemetry/Telemetry.tsx`

The Telemetry panel displays all computed sprint metrics. It reads from `VideoContext` and re-renders whenever the current frame or the computed metrics change.

## Component Structure

The Telemetry panel is a thin tab shell that composes sub-components:

| File | Purpose |
|------|---------|
| `Telemetry.tsx` | Tab shell — reads context, renders active tab |
| `Sparkline.tsx` | Reusable SVG sparkline with optional playhead |
| `SectionHead.tsx` | Sticky section header with colored indicator dot |
| `JointRow.tsx` | Joint angle display with inline sparkline |
| `ContactsTab.tsx` | Symmetry grid + per-step editable table |
| `CoMTab.tsx` | Static mode (displacement/speed/accel) + flying mode (zone timing) |

## Tab Layout

The panel is divided into four tabs:

| Tab | Contents |
|---|---|
| **Steps** | Ground contact events table, step-by-step timing, flight times, step length/frequency |
| **Lower** | Hip, knee, ankle joint angles + thigh and shin segment inclinations |
| **Upper** | Shoulder, elbow, wrist joint angles + torso inclination |
| **CoM** | Center-of-mass horizontal speed, acceleration, displacement, cumulative distance |

## Sparklines

Every metric is displayed as a sparkline — a small time-series chart. Sparklines are implemented as SVG paths computed from the `JointTimeSeries.angle` (or velocity, or accel) array.

### Playhead

A vertical line overlaid on each sparkline tracks the current video frame. When the video plays, the frame index in `VideoContext` updates and the playhead moves across all sparklines simultaneously. This allows the user to see what the metrics look like at any specific moment in the sprint.

### Left/Right comparison

For bilateral joints (hip, knee, ankle, etc.), left and right series are drawn on the same sparkline using two different colours. This makes asymmetries immediately visible — a common indicator of injury risk or technique imbalance.

### Velocity and acceleration

Each joint section includes three sub-rows:
1. **Angle** (degrees)
2. **Velocity** (deg/s)
3. **Acceleration** (deg/s²)

These are computed by `buildSeries` via two passes of `derivative`. See [Math Reference — Numerical Derivative](/math#numerical-derivative-derivative).

## Ground Contact Events Table

The Steps tab shows a table with one row per detected ground contact. Each row displays:

- Foot (left/right)
- Contact frame + lift frame
- Contact time (ms)
- Flight time before (ms)
- Step length (m, if calibrated)
- Step frequency (Hz)
- Foot-to-CoM distance (m, if calibrated)

### Editing contacts

Rows are inline-editable. The contact frame and lift frame can be changed by typing directly in the cell. This is useful when the automatic detection is off by a few frames for a specific contact.

### Manual contacts

The user can click the **+** button to add a contact that the algorithm missed entirely. Manual contacts are stored in `VideoContext` alongside the automatically detected ones and are tagged with `isManual: true`.

### Deleting contacts

Individual rows can be deleted. The recalculated averages (avg contact time, avg flight time, etc.) update immediately.

## Sprint Timing Modes

### Static start

The user marks the frame where the athlete first moves from the blocks. Reaction time is measured from frame 0 to the marked start frame:

$$t_{\text{reaction}} = \frac{f_{\text{start}}}{f_s}$$

### Flying start

The user marks entry and exit frames for a predefined timing zone. Sprint time is:

$$t_{\text{sprint}} = \frac{f_{\text{exit}} - f_{\text{entry}}}{f_s}$$

The mode is toggled in `VideoContext` and the Telemetry panel shows the relevant controls for whichever mode is active.

## Empty State

When no video has been loaded or inference hasn't run yet, the panel reads `PoseContext.status` and displays a contextual message:

| Status | Message |
|---|---|
| `idle` | Upload a video to begin |
| `loading` | Inference in progress... |
| `error` | Backend unavailable |
| `ready` but no calibration | Calibrate to unlock distance metrics |
