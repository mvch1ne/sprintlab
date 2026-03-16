// ─── Telemetry Panel ──────────────────────────────────────────────────────────
// Reads all state from VideoContext and PoseContext — no props needed.
import { useState } from 'react';
import { useVideoContext } from '../VideoContext';
import { usePose } from '../PoseContext';
import { SectionHead } from './SectionHead';
import { JointRow } from './JointRow';
import { ContactsTab } from './ContactsTab';
import { CoMTab } from './CoMTab';

// ── Tabs ───────────────────────────────────────────────────────────────────────
type Tab = 'steps' | 'lower' | 'upper' | 'com';

const TABS: { key: Tab; label: string }[] = [
  { key: 'steps', label: 'Steps' },
  { key: 'lower', label: 'Lower' },
  { key: 'upper', label: 'Upper' },
  { key: 'com', label: 'CoM' },
];

// ── Main component ─────────────────────────────────────────────────────────────
export const Telemetry = () => {
  const {
    currentFrame,
    fps,
    calibration,
    metrics,
    deleteContact,
    editContact,
    comEvents,
    showCoMEvents,
    sprintStart,
    sprintFinish,
    sprintMode,
    sprintDirection,
    confirmedSprintStart,
    reactionTime,
    reactionTimeEnabled,
    setReactionTime,
    setReactionTimeEnabled,
  } = useVideoContext();
  const { status } = usePose();
  const [tab, setTab] = useState<Tab>('steps');

  // Empty / loading state
  if (status !== 'ready' || !metrics) {
    const isUncalibrated = status === 'ready' && !calibration;
    const msg = isUncalibrated
      ? 'Calibrate to unlock telemetry'
      : status === 'idle'
        ? 'Enable pose analysis to compute metrics'
        : status === 'loading'
          ? 'Analysing video…'
          : status === 'error'
            ? 'Pose error — check backend'
            : 'Waiting for metrics…';
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
        {status === 'loading' && (
          <div className="w-4 h-4 border border-zinc-600 border-t-sky-400 rounded-full animate-spin" />
        )}
        <span
          className={`text-xs uppercase tracking-widest font-mono ${isUncalibrated ? 'text-amber-500' : 'text-zinc-500'}`}
        >
          {msg}
        </span>
        {isUncalibrated && (
          <span className="text-xs text-zinc-600 font-mono">
            Use the calibration tool in the control panel
          </span>
        )}
      </div>
    );
  }

  const cal = calibration !== null;
  const f = currentFrame;

  // Left = green, Right = amber — consistent throughout
  const LC = '#4ade80',
    RC = '#fb923c';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs uppercase tracking-widest transition-colors cursor-pointer
              border-r border-zinc-200 dark:border-zinc-800 last:border-r-0
              ${
                tab === t.key
                  ? 'text-sky-500 bg-zinc-50 dark:bg-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        {/* ── Steps ───────────────────────────────────────────────────── */}
        {tab === 'steps' && (
          <ContactsTab
            contacts={metrics.groundContacts}
            calibrated={cal}
            onDelete={deleteContact}
            onEdit={editContact}
          />
        )}

        {/* ── CoM ─────────────────────────────────────────────────────── */}
        {tab === 'com' && (
          <CoMTab
            comSeries={metrics.comSeries}
            com={metrics.com}
            frame={f}
            fps={fps}
            comEvents={showCoMEvents ? comEvents : []}
            sprintStart={sprintStart}
            sprintFinish={sprintFinish}
            sprintMode={sprintMode}
            sprintDirection={sprintDirection}
            confirmedSprintStart={confirmedSprintStart}
            reactionTime={reactionTime}
            reactionTimeEnabled={reactionTimeEnabled}
            setReactionTime={setReactionTime}
            setReactionTimeEnabled={setReactionTimeEnabled}
          />
        )}

        {/* ── Lower body ──────────────────────────────────────────────── */}
        {tab === 'lower' && (
          <>
            <SectionHead label="Hip (interior)" color={LC} />
            <JointRow
              label="Left hip"
              series={metrics.leftHip}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right hip"
              series={metrics.rightHip}
              frame={f}
              color={RC}
            />

            <SectionHead label="Knee (interior)" color={LC} />
            <JointRow
              label="Left knee"
              series={metrics.leftKnee}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right knee"
              series={metrics.rightKnee}
              frame={f}
              color={RC}
            />

            <SectionHead label="Ankle (interior)" color={LC} />
            <JointRow
              label="Left ankle"
              series={metrics.leftAnkle}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right ankle"
              series={metrics.rightAnkle}
              frame={f}
              color={RC}
            />

            <SectionHead label="Segment angles" color={LC} />
            <JointRow
              label="Left thigh (from vertical)"
              series={metrics.leftThigh}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right thigh (from vertical)"
              series={metrics.rightThigh}
              frame={f}
              color={RC}
            />
            <JointRow
              label="Left shin (90°=vertical)"
              series={metrics.leftShin}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shin (90°=vertical)"
              series={metrics.rightShin}
              frame={f}
              color={RC}
            />
          </>
        )}

        {/* ── Upper body ──────────────────────────────────────────────── */}
        {tab === 'upper' && (
          <>
            <SectionHead label="Shoulder (interior)" color="#38bdf8" />
            <JointRow
              label="Left shoulder"
              series={metrics.leftShoulder}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right shoulder"
              series={metrics.rightShoulder}
              frame={f}
              color={RC}
            />

            <SectionHead label="Elbow (interior)" color="#38bdf8" />
            <JointRow
              label="Left elbow"
              series={metrics.leftElbow}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right elbow"
              series={metrics.rightElbow}
              frame={f}
              color={RC}
            />

            <SectionHead label="Wrist (interior)" color="#38bdf8" />
            <JointRow
              label="Left wrist"
              series={metrics.leftWrist}
              frame={f}
              color={LC}
            />
            <JointRow
              label="Right wrist"
              series={metrics.rightWrist}
              frame={f}
              color={RC}
            />

            <SectionHead label="Trunk" color="#fb923c" />
            <JointRow
              label="Torso inclination (90°=upright)"
              series={metrics.torso}
              frame={f}
              color="#fb923c"
            />
          </>
        )}
      </div>
    </div>
  );
};
