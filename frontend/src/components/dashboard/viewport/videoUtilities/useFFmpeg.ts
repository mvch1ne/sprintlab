// Singleton FFmpeg instance shared across the app.
//
// In Electron (packaged):
//   The frontend is served from a local HTTP server (not file://) so the page
//   gets a real origin. FFmpeg WASM files are in frontend/dist/ffmpeg/ and
//   loaded from the same origin via toBlobURL — no cross-origin issues.
//
// In the browser (web / dev mode):
//   Files are fetched from the unpkg CDN via toBlobURL (standard approach).
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    // In Electron the page is served from http://127.0.0.1:<port>, so
    // FFmpeg WASM files at /ffmpeg/* are same-origin — blob URLs work.
    const base = isElectron()
      ? `${window.location.origin}/ffmpeg`
      : CDN;

    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}
