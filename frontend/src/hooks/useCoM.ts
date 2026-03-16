import { useState, useRef, useCallback, useEffect } from 'react';
import type { CoMEvent } from '../components/dashboard/VideoContext';
import type { Keypoint } from '../components/dashboard/viewport/PoseEngine/usePoseLandmarker';

/**
 * Manages Centre of Mass display toggle and recorded CoM events.
 */
export function useCoM(
  getKeypoints: (frame: number) => Keypoint[],
  currentFrameRef: React.RefObject<number>,
) {
  const [showCoM, setShowCoM] = useState(true);
  const [comEvents, setComEvents] = useState<CoMEvent[]>([]);
  const [showCoMEvents, setShowCoMEvents] = useState(true);

  const getKeypointsRef = useRef(getKeypoints);
  useEffect(() => {
    getKeypointsRef.current = getKeypoints;
  }, [getKeypoints]);

  const recordEvent = useCallback(() => {
    const frame = currentFrameRef.current;
    const kp = getKeypointsRef.current(frame);
    const lHip = kp[11];
    const rHip = kp[12];
    if (!lHip || !rHip || lHip.score < 0.35 || rHip.score < 0.35) return;
    const newEvent: CoMEvent = {
      frame,
      comSite: { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 },
    };
    setComEvents((prev) => [...prev, newEvent]);
  }, [currentFrameRef]);

  const toggleCoM = useCallback(() => setShowCoM((v) => !v), []);
  const toggleCoMEvents = useCallback(() => setShowCoMEvents((v) => !v), []);
  const clearEvents = useCallback(() => setComEvents([]), []);

  const reset = useCallback(() => {
    setComEvents([]);
    setShowCoMEvents(true);
  }, []);

  return {
    showCoM,
    comEvents,
    showCoMEvents,
    recordEvent,
    toggleCoM,
    toggleCoMEvents,
    clearEvents,
    reset,
  };
}
