import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
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

export function usePoseLandmarker(enabled: boolean): UsePoseLandmarkerReturn {
  const [status, setStatus] = useState<LandmarkerStatus>('idle');
  const [result, setResult] = useState<PoseResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const lastTimestampRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled) return;
    if (landmarkerRef.current) return;

    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          },
        );

        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setStatus('ready');
      } catch (err) {
        console.error('PoseLandmarker load error:', err);
        if (!cancelled) setStatus('error');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  const detect = useCallback(
    (videoEl: HTMLVideoElement, timestampMs: number) => {
      const lm = landmarkerRef.current;
      if (!lm || status !== 'ready') return;
      const ts = Math.floor(timestampMs);
      if (ts <= lastTimestampRef.current) return;
      lastTimestampRef.current = ts;
      try {
        const res = lm.detectForVideo(videoEl, ts);
        setResult({ landmarks: res.landmarks, timestamp: ts });
      } catch {
        // silently skip bad frames
      }
    },
    [status],
  );

  return { status, result, detect };
}
