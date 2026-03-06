import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './useFFmpeg';

export async function probeVideoFps(src: string): Promise<number> {
  try {
    const ffmpeg = await getFFmpeg();
    await ffmpeg.writeFile('probe.mp4', await fetchFile(src));

    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => logs.push(message);
    ffmpeg.on('log', onLog);

    try {
      await ffmpeg.exec(['-i', 'probe.mp4']);
    } catch {
      // ffmpeg exits non-zero when no output file is given — expected
    } finally {
      // Always detach BEFORE parsing so all log lines are captured
      ffmpeg.off('log', onLog);
    }

    try {
      await ffmpeg.deleteFile('probe.mp4');
    } catch {
      /* ignore */
    }

    const streamLine = logs.find((l) => l.includes('Video:'));
    if (streamLine) {
      const m = streamLine.match(/(\d+(?:\.\d+)?)\s*fps/);
      if (m) return parseFloat(m[1]);
      const tbr = streamLine.match(/(\d+(?:\.\d+)?)\s*tbr/);
      if (tbr) return parseFloat(tbr[1]);
    }

    console.warn('[probeVideoFps] could not parse fps, logs:', logs);
    return 30;
  } catch (err) {
    console.warn('[probeVideoFps] failed:', err);
    return 30;
  }
}
