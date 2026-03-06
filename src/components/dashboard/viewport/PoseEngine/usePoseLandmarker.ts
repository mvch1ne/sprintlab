// ─── MoveNet Thunder via TensorFlow.js ───────────────────────────────────────
// Replaces MediaPipe Pose. MoveNet Thunder is more accurate on fast movement
// and runs entirely in the browser via WebGL backend — no server needed.
//
// Output: 17 keypoints in COCO format.
// Each keypoint from the raw tensor: [y, x, score] normalised 0–1.
// We normalise to { x, y, visibility } to keep the same interface as before.

import { useEffect, useRef, useState, useCallback } from 'react';

export interface NormalizedLandmark {
  x: number; // 0–1 normalised to frame width
  y: number; // 0–1 normalised to frame height
  z: number; // always 0 (MoveNet has no depth)
  visibility?: number; // confidence score 0–1
}

export interface PoseResult {
  landmarks: NormalizedLandmark[][];
  timestamp: number;
}

export type LandmarkerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UsePoseLandmarkerReturn {
  status: LandmarkerStatus;
  result: PoseResult | null;
  detect: (videoEl: HTMLVideoElement, timestampMs: number) => void;
}

// Lazy-load TF.js and MoveNet — only pulled in when pose is enabled
async function loadMoveNet() {
  // Dynamic imports so the bundle isn't bloated when pose is off
  const tf = await import('@tensorflow/tfjs');
  await import('@tensorflow/tfjs-backend-webgl');
  await tf.setBackend('webgl');
  await tf.ready();

  const poseDetection = await import('@tensorflow-models/pose-detection');
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
      enableSmoothing: true,
    },
  );
  return { tf, detector };
}

export function usePoseLandmarker(enabled: boolean): UsePoseLandmarkerReturn {
  const [status, setStatus] = useState<LandmarkerStatus>('idle');
  const [result, setResult] = useState<PoseResult | null>(null);
  const detectorRef = useRef<
    Awaited<ReturnType<typeof loadMoveNet>>['detector'] | null
  >(null);
  const lastTimestampRef = useRef<number>(-1);
  const detectingRef = useRef(false); // guard against overlapping calls

  useEffect(() => {
    if (!enabled) return;
    if (detectorRef.current) return; // already loaded

    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      try {
        const { detector } = await loadMoveNet();
        if (cancelled) {
          detector.dispose?.();
          return;
        }
        detectorRef.current = detector;
        setStatus('ready');
      } catch (err) {
        console.error('[MoveNet] load error:', err);
        if (!cancelled) setStatus('error');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      detectorRef.current?.dispose?.();
      detectorRef.current = null;
    };
  }, []);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setStatus('idle');
      detectorRef.current?.dispose?.();
      detectorRef.current = null;
      lastTimestampRef.current = -1;
    }
  }, [enabled]);

  const detect = useCallback(
    async (videoEl: HTMLVideoElement, timestampMs: number) => {
      const detector = detectorRef.current;
      if (!detector || status !== 'ready') return;
      if (detectingRef.current) return; // skip if previous call still running

      const ts = Math.floor(timestampMs);
      if (ts <= lastTimestampRef.current) return;
      lastTimestampRef.current = ts;

      detectingRef.current = true;
      try {
        const poses = await detector.estimatePoses(videoEl, {
          maxPoses: 1,
          flipHorizontal: false,
        });

        if (poses.length === 0) {
          detectingRef.current = false;
          return;
        }

        // MoveNet keypoints: { x, y, score, name } — x/y are in pixel coords
        // Normalise to 0–1 using the video element's natural dimensions
        const vw = videoEl.videoWidth || videoEl.clientWidth || 1;
        const vh = videoEl.videoHeight || videoEl.clientHeight || 1;

        const landmarks: NormalizedLandmark[] = poses[0].keypoints.map(
          (kp) => ({
            x: kp.x / vw,
            y: kp.y / vh,
            z: 0,
            visibility: kp.score ?? 0,
          }),
        );

        setResult({ landmarks: [landmarks], timestamp: ts });
      } catch (err) {
        // Silently skip bad frames — can happen mid-seek
        console.warn('[MoveNet] detect error:', err);
      } finally {
        detectingRef.current = false;
      }
    },
    [status],
  );

  return { status, result, detect };
}
