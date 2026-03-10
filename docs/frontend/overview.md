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
| State | React Context (`VideoContext`, `PoseContext`) |
| Testing | Vitest 3 + jsdom + @testing-library/react |

## Directory Structure

```
frontend/src/
├── components/
│   ├── dashboard/
│   │   ├── viewport/
│   │   │   ├── PoseEngine/          # Pose detection + skeleton overlay
│   │   │   ├── CalibrationAndMeasurements/
│   │   │   ├── TrimAndCrop/
│   │   │   ├── StatusBar/
│   │   │   ├── videoUtilities/      # Export helpers
│   │   │   └── Viewport.tsx         # Central orchestrator
│   │   ├── telemetry/
│   │   │   └── Telemetry.tsx        # Metrics panel
│   │   ├── useSprintMetrics.ts      # React hook — metrics computation
│   │   ├── sprintMath.ts            # Pure math (no React)
│   │   ├── VideoContext.tsx
│   │   └── PoseContext.tsx
│   ├── layout/                      # Header, Dashboard shell
│   └── ui/                          # Shared Shadcn components
├── lib/                             # Utilities
└── test/                            # Vitest setup
```

## Component Hierarchy

```
App
└── Dashboard
    ├── Viewport          ← left panel: video + all overlays
    │   ├── PoseOverlay
    │   ├── CalibrationOverlay
    │   ├── MeasurementOverlay
    │   └── CropOverlay
    └── Telemetry         ← right panel: metrics + charts
```

Both `Viewport` and `Telemetry` read from and write to `VideoContext`. They do not pass props to each other directly.

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
