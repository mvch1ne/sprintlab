'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  onFullscreenChange: (callback) =>
    ipcRenderer.on('fullscreen-change', (_event, isFullscreen) => callback(isFullscreen)),
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),

  // Read a file from process.resourcesPath (outside asar, real disk path).
  // Used to load FFmpeg WASM without fetch() — avoids the blob:null cross-origin
  // issue when the page loads from file://.
  readResourceFile: (relativePath) => {
    const fullPath = path.join(process.resourcesPath, relativePath);
    const buf = fs.readFileSync(fullPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
});
