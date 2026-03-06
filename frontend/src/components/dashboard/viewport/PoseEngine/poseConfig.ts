// ─── MoveNet / COCO 17-Keypoint Definitions ──────────────────────────────────
// MoveNet Thunder outputs 17 keypoints in COCO format.
// Each keypoint: [y, x, score] normalised 0-1 relative to image dimensions.

export interface LandmarkDef {
  index: number;
  name: string;
  region: 'face' | 'upper' | 'core' | 'lower';
  defaultOff?: boolean;
}

export const LANDMARKS: LandmarkDef[] = [
  // Face
  { index: 0, name: 'Nose', region: 'face' },
  { index: 1, name: 'Left Eye', region: 'face', defaultOff: true },
  { index: 2, name: 'Right Eye', region: 'face', defaultOff: true },
  { index: 3, name: 'Left Ear', region: 'face', defaultOff: true },
  { index: 4, name: 'Right Ear', region: 'face', defaultOff: true },
  // Upper body
  { index: 5, name: 'Left Shoulder', region: 'upper' },
  { index: 6, name: 'Right Shoulder', region: 'upper' },
  { index: 7, name: 'Left Elbow', region: 'upper' },
  { index: 8, name: 'Right Elbow', region: 'upper' },
  { index: 9, name: 'Left Wrist', region: 'upper' },
  { index: 10, name: 'Right Wrist', region: 'upper' },
  // Core
  { index: 11, name: 'Left Hip', region: 'core' },
  { index: 12, name: 'Right Hip', region: 'core' },
  // Lower body
  { index: 13, name: 'Left Knee', region: 'lower' },
  { index: 14, name: 'Right Knee', region: 'lower' },
  { index: 15, name: 'Left Ankle', region: 'lower' },
  { index: 16, name: 'Right Ankle', region: 'lower' },
];

// Skeleton connections — pairs of landmark indices (COCO convention)
export const CONNECTIONS: [number, number][] = [
  // Face
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  // Shoulders
  [5, 6],
  // Left arm
  [5, 7],
  [7, 9],
  // Right arm
  [6, 8],
  [8, 10],
  // Torso
  [5, 11],
  [6, 12],
  [11, 12],
  // Left leg
  [11, 13],
  [13, 15],
  // Right leg
  [12, 14],
  [14, 16],
];

// Region colors
export const REGION_COLORS: Record<LandmarkDef['region'], string> = {
  face: '#a78bfa', // violet
  upper: '#38bdf8', // sky
  core: '#fb923c', // orange
  lower: '#4ade80', // green
};

export const buildDefaultVisibility = (): Record<number, boolean> => {
  const map: Record<number, boolean> = {};
  for (const lm of LANDMARKS) {
    map[lm.index] = !lm.defaultOff;
  }
  return map;
};
