'use strict';

const { app, BrowserWindow, Menu, session, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const isDev = !app.isPackaged;

let backendProcess = null;
let mainWindow = null;
let splashWindow = null;

// ── Backend ────────────────────────────────────────────────────────────────────

function getBackendPath() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(
    process.resourcesPath,
    'backend',
    `SprintLabBackend${ext}`
  );
}

function startBackend() {
  if (isDev) return; // dev: user runs `uvicorn server:app` separately
  const binPath = getBackendPath();
  backendProcess = spawn(binPath, [], {
    stdio: 'ignore',
    detached: false,
  });
  backendProcess.on('error', (err) => {
    console.error('[backend] failed to start:', err.message);
  });
}

async function waitForBackend(retries = 40, intervalMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://localhost:8000/health');
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Backend did not become ready in time.');
}

// ── Menu ───────────────────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    // macOS: app menu must be first
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        {
          role: 'togglefullscreen',
          // Electron sets the right accelerator per platform:
          //   macOS  → Ctrl+Cmd+F
          //   Win/Linux → F11
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Windows ────────────────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 200,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    show: false,
    webPreferences: { contextIsolation: true },
  });

  const splashHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; height:100vh; gap:14px;
    background:#09090b; color:#e4e4e7;
    font-family: ui-monospace, 'Cascadia Code', monospace;
  }
  .dot { width:8px; height:8px; border-radius:50%; background:#38bdf8; }
  .title { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#a1a1aa; }
  .sub   { font-size:10px; color:#52525b; }
  .row   { display:flex; align-items:center; gap:8px; }
</style>
</head>
<body>
  <div class="row"><div class="dot"></div><span class="title">SprintLab</span></div>
  <div class="sub">Starting analysis engine…</div>
</body>
</html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function setSharedBufferHeaders() {
  // Required for FFmpeg WASM (SharedArrayBuffer)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'SprintLab',
    // Icon used by the taskbar / dock (Linux always uses this; Windows uses .ico from resources)
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  buildMenu();
  setSharedBufferHeaders();

  if (!isDev) {
    createSplash();
    startBackend();
    try {
      await waitForBackend();
    } catch (err) {
      console.error(err.message);
      // Continue anyway — user will see backend errors in the UI
    }
  }

  createMainWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked with no windows open
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
