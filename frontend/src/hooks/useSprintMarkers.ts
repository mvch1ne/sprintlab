import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ManualContact, SprintMarker } from '../components/dashboard/viewport/PoseEngine/PoseOverlay';
import type { GroundContactEvent, SprintMetrics } from '../components/dashboard/useSprintMetrics';
import type { CalibrationData } from '../components/dashboard/viewport/CalibrationAndMeasurements/CalibrationOverlay';

export type { ManualContact, SprintMarker };

/**
 * Manages sprint markers, manual ground contacts, deleted contacts,
 * annotate mode, and the merged contacts list.
 */
export function useSprintMarkers(opts: {
  metrics: SprintMetrics | null;
  fps: number;
  calibration: CalibrationData | null;
  poseFrameW: number;
  sprintStart: SprintMarker | null;
}) {
  const { metrics, fps, calibration, poseFrameW, sprintStart } = opts;

  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [deletedContactIds, setDeletedContactIds] = useState<Set<string>>(new Set());
  const [annotateMode, setAnnotateMode] = useState<
    'off' | 'left' | 'right' | 'start' | 'finish'
  >('off');

  const manualContactsRef = useRef(manualContacts);
  const mergedContactsRef = useRef<GroundContactEvent[]>([]);

  useEffect(() => {
    manualContactsRef.current = manualContacts;
  }, [manualContacts]);

  // Merged contacts (auto-detected + manually placed)
  const mergedContacts = useMemo<GroundContactEvent[]>(() => {
    const autoEvents = (metrics?.groundContacts ?? []).filter(
      (c) => !c.id || !deletedContactIds.has(c.id),
    );
    if (manualContacts.length === 0 && deletedContactIds.size === 0)
      return autoEvents;

    const contactDurationFrames = Math.max(1, Math.round(0.08 * fps));
    const manualEvents: GroundContactEvent[] = manualContacts.map((m) => {
      const lift = m.liftFrame ?? m.contactFrame + contactDurationFrames;
      return {
        id: m.id,
        isManual: true,
        foot: m.foot,
        contactFrame: m.contactFrame,
        liftFrame: lift,
        contactTime: (lift - m.contactFrame) / fps,
        flightTimeBefore: 0,
        contactSite: m.contactSite,
        comAtContact: { x: 0, y: 0 },
        comDistance: 0,
        stepLength: null,
        stepFrequency: null,
      };
    });

    const all = [...autoEvents, ...manualEvents].sort(
      (a, b) => a.contactFrame - b.contactFrame,
    );

    // Re-scale helper (horizontal step length only)
    const hScale =
      calibration && poseFrameW > 0
        ? (dx: number) =>
            ((Math.abs(dx) / poseFrameW) * calibration.aspectRatio) /
            calibration.pixelsPerMeter
        : null;

    return all.map((c, i) => {
      const contactTime = (c.liftFrame - c.contactFrame) / fps;
      if (i === 0) {
        const startLineX = sprintStart?.site.x ?? null;
        const firstStepLength =
          startLineX !== null && hScale
            ? hScale(Math.abs(c.contactSite.x - startLineX))
            : null;
        return {
          ...c,
          contactTime,
          stepLength: firstStepLength,
          stepFrequency: null,
          flightTimeBefore: 0,
        };
      }
      const prev = all[i - 1];
      const dx = Math.abs(c.contactSite.x - prev.contactSite.x);
      return {
        ...c,
        contactTime,
        stepLength: hScale ? hScale(dx) : null,
        stepFrequency:
          c.contactFrame > prev.contactFrame
            ? 1 / ((c.contactFrame - prev.contactFrame) / fps)
            : null,
        flightTimeBefore: Math.max(0, (c.contactFrame - prev.liftFrame) / fps),
      };
    });
  }, [metrics, manualContacts, deletedContactIds, fps, calibration, poseFrameW, sprintStart]);

  useEffect(() => {
    mergedContactsRef.current = mergedContacts;
  }, [mergedContacts]);

  // Metrics with merged contacts
  const metricsWithMerged = useMemo(() => {
    if (!metrics) return null;
    if (manualContacts.length === 0 && deletedContactIds.size === 0) return metrics;
    const gc = mergedContacts;
    const _avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      ...metrics,
      groundContacts: gc,
      avgContactTime: _avg(gc.map((c) => c.contactTime)),
      avgFlightTime: _avg(gc.map((c) => c.flightTimeBefore).filter((t) => t > 0)),
      avgStepLength: (() => {
        const sl = gc.flatMap((c) => (c.stepLength !== null ? [c.stepLength] : []));
        return sl.length ? _avg(sl) : null;
      })(),
      avgStepFreq: (() => {
        const sf = gc.flatMap((c) => (c.stepFrequency !== null ? [c.stepFrequency] : []));
        return sf.length ? _avg(sf) : null;
      })(),
      avgComDistance: (() => {
        const cd = gc.filter((c) => c.comDistance !== 0).map((c) => c.comDistance);
        return cd.length ? _avg(cd) : null;
      })(),
    };
  }, [metrics, manualContacts.length, deletedContactIds.size, mergedContacts]);

  // Stable delete handler
  const deleteContact = useCallback((id: string) => {
    if (manualContactsRef.current.some((m) => m.id === id)) {
      setManualContacts((prev) => prev.filter((m) => m.id !== id));
    } else {
      setDeletedContactIds((prev) => new Set([...prev, id]));
    }
  }, []);

  // Stable edit handler
  const editContact = useCallback(
    (id: string, contactFrame: number, liftFrame: number) => {
      if (manualContactsRef.current.some((m) => m.id === id)) {
        setManualContacts((prev) =>
          prev.map((m) => (m.id === id ? { ...m, contactFrame, liftFrame } : m)),
        );
      } else {
        const existing = mergedContactsRef.current.find((c) => c.id === id);
        if (!existing) return;
        setDeletedContactIds((prev) => new Set([...prev, id]));
        setManualContacts((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            foot: existing.foot,
            contactFrame,
            liftFrame,
            contactSite: existing.contactSite,
          },
        ]);
      }
    },
    [],
  );

  const addContact = useCallback((c: ManualContact) => {
    setManualContacts((prev) => [...prev, c]);
  }, []);

  const moveContact = useCallback((id: string, site: { x: number; y: number }) => {
    setManualContacts((prev) =>
      prev.map((m) => (m.id === id ? { ...m, contactSite: site } : m)),
    );
  }, []);

  const clearManualContacts = useCallback(() => {
    setManualContacts([]);
  }, []);

  const toggleAnnotateMode = useCallback(() => {
    setAnnotateMode((m) => (m !== 'off' ? 'off' : 'left'));
  }, []);

  const reset = useCallback(() => {
    setManualContacts([]);
    setDeletedContactIds(new Set());
    setAnnotateMode('off');
  }, []);

  return {
    manualContacts,
    deletedContactIds,
    annotateMode,
    setAnnotateMode,
    mergedContacts,
    metricsWithMerged,
    deleteContact,
    editContact,
    addContact,
    moveContact,
    clearManualContacts,
    toggleAnnotateMode,
    reset,
  };
}
