import { ScanLine, Settings2 } from 'lucide-react';
import { IconBtn } from './shared';
import type { LandmarkerStatus } from '../PoseEngine/usePoseLandmarker';

interface PoseControlsProps {
  poseEnabled: boolean;
  onTogglePose: () => void;
  poseStatus: LandmarkerStatus;
  backendReachable?: boolean;
  showPosePanel: boolean;
  onTogglePosePanel: () => void;
  disabled?: boolean;
}

export function PoseControls({
  poseEnabled,
  onTogglePose,
  poseStatus,
  backendReachable = false,
  showPosePanel,
  onTogglePosePanel,
}: PoseControlsProps) {
  return (
    <>
      <div className="relative">
        <IconBtn
          onClick={onTogglePose}
          tooltip={
            poseStatus === 'loading'
              ? 'Loading pose model\u2026'
              : poseStatus === 'error'
                ? 'Pose model failed to load'
                : poseEnabled
                  ? 'Disable pose detection'
                  : 'Enable pose detection'
          }
          active={poseEnabled}
        >
          {poseStatus === 'loading' ? (
            <span className="text-[10px] animate-pulse">\u2026</span>
          ) : (
            <ScanLine size={14} />
          )}
        </IconBtn>
        {/* Backend reachability dot */}
        <span
          className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full border border-zinc-900 ${
            backendReachable ? 'bg-emerald-400' : 'bg-zinc-600'
          }`}
          title={backendReachable ? 'Backend ready' : 'Backend unreachable'}
        />
      </div>

      <IconBtn
        onClick={onTogglePosePanel}
        tooltip={
          showPosePanel ? 'Hide landmark config' : 'Configure landmarks'
        }
        active={showPosePanel}
        disabled={!poseEnabled}
      >
        <Settings2 size={14} />
      </IconBtn>
    </>
  );
}
