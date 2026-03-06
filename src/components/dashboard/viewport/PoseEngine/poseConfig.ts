// ─── MediaPipe Pose Landmark Definitions ────────────────────────────────────
// All 33 landmarks with display names and body region groupings.
// DEFAULT_OFF: landmarks that are hidden by default (face detail, minor points).
// CONNECTIONS: pairs of landmark indices that form skeleton lines.
// Lines are inferred automatically — if either endpoint is hidden, the line is skipped.

export interface LandmarkDef {
  index: number;
  name: string;
  region: 'face' | 'upper' | 'core' | 'lower';
  defaultOff?: boolean;
}

export const LANDMARKS: LandmarkDef[] = [
  // Face
  { index: 0, name: 'Nose', region: 'face' },
  { index: 1, name: 'Left Eye Inner', region: 'face', defaultOff: true },
  { index: 2, name: 'Left Eye', region: 'face', defaultOff: true },
  { index: 3, name: 'Left Eye Outer', region: 'face', defaultOff: true },
  { index: 4, name: 'Right Eye Inner', region: 'face', defaultOff: true },
  { index: 5, name: 'Right Eye', region: 'face', defaultOff: true },
  { index: 6, name: 'Right Eye Outer', region: 'face', defaultOff: true },
  { index: 7, name: 'Left Ear', region: 'face', defaultOff: true },
  { index: 8, name: 'Right Ear', region: 'face', defaultOff: true },
  { index: 9, name: 'Mouth Left', region: 'face', defaultOff: true },
  { index: 10, name: 'Mouth Right', region: 'face', defaultOff: true },
  // Upper body
  { index: 11, name: 'Left Shoulder', region: 'upper' },
  { index: 12, name: 'Right Shoulder', region: 'upper' },
  { index: 13, name: 'Left Elbow', region: 'upper' },
  { index: 14, name: 'Right Elbow', region: 'upper' },
  { index: 15, name: 'Left Wrist', region: 'upper' },
  { index: 16, name: 'Right Wrist', region: 'upper' },
  { index: 17, name: 'Left Pinky', region: 'upper', defaultOff: true },
  { index: 18, name: 'Right Pinky', region: 'upper', defaultOff: true },
  { index: 19, name: 'Left Index', region: 'upper', defaultOff: true },
  { index: 20, name: 'Right Index', region: 'upper', defaultOff: true },
  { index: 21, name: 'Left Thumb', region: 'upper', defaultOff: true },
  { index: 22, name: 'Right Thumb', region: 'upper', defaultOff: true },
  // Core
  { index: 23, name: 'Left Hip', region: 'core' },
  { index: 24, name: 'Right Hip', region: 'core' },
  // Lower body
  { index: 25, name: 'Left Knee', region: 'lower' },
  { index: 26, name: 'Right Knee', region: 'lower' },
  { index: 27, name: 'Left Ankle', region: 'lower' },
  { index: 28, name: 'Right Ankle', region: 'lower' },
  { index: 29, name: 'Left Heel', region: 'lower', defaultOff: true },
  { index: 30, name: 'Right Heel', region: 'lower', defaultOff: true },
  { index: 31, name: 'Left Foot Index', region: 'lower' },
  { index: 32, name: 'Right Foot Index', region: 'lower' },
];

// Skeleton connections — pairs of landmark indices
export const CONNECTIONS: [number, number][] = [
  // Face outline
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  // Shoulders
  [11, 12],
  // Left arm
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  // Right arm
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  // Torso
  [11, 23],
  [12, 24],
  [23, 24],
  // Left leg
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31],
  // Right leg
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32],
];

// Region colors
export const REGION_COLORS: Record<LandmarkDef['region'], string> = {
  face: '#a78bfa', // violet
  upper: '#38bdf8', // sky
  core: '#fb923c', // orange
  lower: '#4ade80', // green
};

// Build default visibility map from LANDMARKS
export const buildDefaultVisibility = (): Record<number, boolean> => {
  const map: Record<number, boolean> = {};
  for (const lm of LANDMARKS) {
    map[lm.index] = !lm.defaultOff;
  }
  return map;
};
