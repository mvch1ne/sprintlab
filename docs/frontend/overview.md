# Frontend Overview

The frontend is a React 19 single-page application written in TypeScript, built with Vite. It is entirely self-contained: pose estimation is offloaded to the backend, but all other processing (metric computation, video trimming, export) happens in the browser.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Styling | TailwindCSS 4 + Figtree variable font |
| UI primitives | Radix UI + Shadcn/ui |
| Video processing | FFmpeg.js (WebAssembly) |
| State | React Context (`UIContext`, `VideoContext`, `PoseContext`) |
| Testing | Vitest 3 + jsdom + @testing-library/react |

## Directory Structure

```
frontend/src/
├── hooks/                             # Custom hooks extracted from Viewport
│   ├── useVideoPlayback.ts            # Video loading, playback, frame tracking
│   ├── useZoomPan.ts                  # Viewport zoom/pan transforms
│   ├── useCalibration.ts              # 2-point scale reference calibration
│   ├── useMeasurements.ts             # Distance & angle measurements
│   ├── useSprintMarkers.ts            # Sprint markers, manual/merged contacts
│   ├── useCoM.ts                      # Centre of Mass display & events
│   └── useTrimCrop.ts                 # Trim & crop panel state
├── components/
│   ├── dashboard/
│   │   ├── viewport/
│   │   │   ├── PoseEngine/            # Pose detection + skeleton overlay
│   │   │   ├── CalibrationAndMeasurements/
│   │   │   ├── TrimAndCrop/
│   │   │   ├── StatusBar/
│   │   │   ├── videoUtilities/        # Export helpers
│   │   │   ├── controls/             # Split control panel sub-components
│   │   │   │   ├── PlaybackControls.tsx
│   │   │   │   ├── CalibrationControls.tsx
│   │   │   │   ├── PoseControls.tsx
│   │   │   │   ├── SprintControls.tsx
│   │   │   │   ├── Timeline.tsx
│   │   │   │   ├── Scrubber.tsx       # Legacy (replaced by Timeline)
│   │   │   │   └── shared.tsx
│   │   │   ├── StageBar.tsx            # Workflow stage tabs with completion dots
│   │   │   ├── Viewport.tsx           # Orchestrator — composes hooks + overlays
│   │   │   └── ControlPanel.tsx       # Thin layout composing control groups
│   │   ├── telemetry/
│   │   │   ├── Telemetry.tsx          # Tab shell — composes sub-components
│   │   │   ├── Sparkline.tsx          # Reusable SVG sparkline
│   │   │   ├── SectionHead.tsx        # Sticky section header
│   │   │   ├── JointRow.tsx           # Joint angle row with sparkline
│   │   │   ├── ContactsTab.tsx        # Symmetry grid + per-step table
│   │   │   └── CoMTab.tsx             # Static + flying mode CoM analysis
│   │   ├── useSprintMetrics.ts        # React hook — metrics computation
│   │   ├── sprintMath.ts              # Pure math (no React)
│   │   ├── UIContext.tsx               # Stage workflow + UI state
│   │   ├── VideoContext.tsx
│   │   └── PoseContext.tsx
│   ├── layout/                        # Header, Dashboard shell
│   └── ui/                            # Shared Shadcn components
├── lib/                               # Utilities
└── test/                              # Vitest setup
```

## Component Hierarchy

```
App
└── Dashboard                     ← wraps UIProvider → VideoProvider → PoseProvider
    ├── Viewport                  ← right panel: orchestrator composing 7 hooks
    │   ├── VideoLayer
    │   ├── PoseOverlay
    │   ├── CalibrationOverlay
    │   ├── MeasurementOverlay
    │   ├── CropOverlay
    │   ├── StageBar              ← workflow stage tabs (Import → Report)
    │   └── ControlPanel          ← stage-aware layout composing control groups
    │       ├── PlaybackControls
    │       ├── CalibrationControls
    │       ├── PoseControls
    │       ├── SprintControls
    │       └── Timeline          ← multi-lane zoomable timeline
    └── Telemetry                 ← left panel: tab shell composing sub-components
        ├── ContactsTab
        ├── JointRow + Sparkline
        └── CoMTab
```

Both `Viewport` and `Telemetry` read from and write to `VideoContext`. They do not pass props to each other directly.

## Hook Architecture

Viewport composes seven custom hooks that each own a slice of state. This keeps the orchestrator focused on layout and cross-hook coordination:

| Hook | Owns |
|------|------|
| `useVideoPlayback` | Video file loading, playback state, frame tracking |
| `useZoomPan` | Viewport scale/translate transforms |
| `useCalibration` | 2-point reference line calibration |
| `useMeasurements` | Distance & angle measurement overlays |
| `useSprintMarkers` | Sprint markers, manual contacts, merged contact list |
| `useCoM` | Centre of Mass visibility & recorded events |
| `useTrimCrop` | Trim/crop panel and crop rect state |

When a new video is loaded, `useVideoPlayback` calls a `resetAll` callback that resets all other hooks. This callback is assigned via a ref to solve the circular initialization order (hooks declared before the callback can reference hooks declared after).

## Key Data Types

### `Keypoint`

```typescript
interface Keypoint {
  x: number;      // inference-frame pixel x
  y: number;      // inference-frame pixel y
  score: number;  // confidence [0, 1]
}
```

### `SprintMetrics`

The output of `useSprintMetrics`. Contains all computed data for a clip:

```typescript
interface SprintMetrics {
  groundContacts: GroundContactEvent[];
  avgContactTime: number;
  avgFlightTime: number;
  avgStepLength: number | null;
  avgStepFreq: number | null;
  avgComDistance: number | null;

  // Per-frame joint time series (one per joint, both sides)
  leftHip: JointTimeSeries;
  rightHip: JointTimeSeries;
  // ... knee, ankle, shoulder, elbow, wrist ...
  torso: JointTimeSeries;
  leftThigh: JointTimeSeries;
  rightThigh: JointTimeSeries;
  leftShin: JointTimeSeries;
  rightShin: JointTimeSeries;

  com: { frame: number; x: number; y: number }[];
  comSeries: CoMSeries;
}
```

### `JointTimeSeries`

```typescript
interface JointTimeSeries {
  frames: number[];    // [0, 1, 2, ..., N-1]
  angle: number[];     // degrees, smoothed
  velocity: number[];  // deg/s, smoothed
  accel: number[];     // deg/s², smoothed
}
```

### `GroundContactEvent`

```typescript
interface GroundContactEvent {
  foot: 'left' | 'right';
  contactFrame: number;
  liftFrame: number;
  contactTime: number;          // seconds
  flightTimeBefore: number;     // seconds
  contactSite: { x: number; y: number };
  comAtContact: { x: number; y: number };
  comDistance: number;          // metres (signed)
  stepLength: number | null;    // metres
  stepFrequency: number | null; // Hz
}
```
