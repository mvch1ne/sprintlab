import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Play } from 'lucide-react';
import { Pause } from 'lucide-react';

export function ControlPanel() {
  const [isPlaying, setIsPlaying] = useState(true);
  const playPauseBtnStyle =
    'h-full fill-green-700 stroke-green-700 hover:cursor-pointer';

  return (
    <div className="ControlPanelContainer h-full w-full flex flex-col">
      <div className="TopBar h-5 shrink-0 border border-b-0 border-border"></div>
      <div className="MainControls flex-1 border border-t-0 border-border flex flex-col">
        <div className="ProgressBarSection h-2 flex justify-center">
          <Progress
            className="w-[90%] mt-2 h-full shrink-0 hover:cursor-pointer"
            value={5}
          />
        </div>
        <div className="ControlInputSection flex flex-1 items-center px-4">
          {isPlaying ? (
            <Pause className={playPauseBtnStyle} />
          ) : (
            <Play className={playPauseBtnStyle} />
          )}
        </div>
      </div>
    </div>
  );
}
