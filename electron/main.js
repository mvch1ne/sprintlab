'use strict';

const { app, BrowserWindow, Menu, session, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = !app.isPackaged;

let backendProcess = null;
let mainWindow = null;
let splashWindow = null;
let frontendURL = null;

// ── Static file server (production) ─────────────────────────────────────────
// Serves frontend/dist over HTTP so the page gets a real origin.
// file:// gives a null (opaque) origin which breaks blob URL cross-origin
// checks inside FFmpeg's WASM Worker — blobs from null origins are each
// unique opaque origins, so the Worker can never fetch the WASM blob.

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

      const { pathname } = new URL(req.url, 'http://localhost');
      const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname).slice(1);
      const filePath = path.join(rootDir, rel);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback — serve index.html for client-side routes
          fs.readFile(path.join(rootDir, 'index.html'), (_, html) => {
            if (html) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(html);
            } else {
              res.writeHead(404);
              res.end();
            }
          });
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

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

async function waitForBackend(retries = 120, intervalMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://localhost:8000/health');
      if (res.ok) {
        setSplashStatus('Pose engine ready', 'green');
        return;
      }
    } catch {
      // not ready yet
    }
    const elapsed = ((i + 1) * intervalMs / 1000).toFixed(0);
    setSplashStatus(`Loading pose engine… ${elapsed}s`, 'blue');
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

function setSplashStatus(text, accent) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const color = accent === 'green' ? '#4ade80' : accent === 'red' ? '#f87171' : '#38bdf8';
  splashWindow.webContents.executeJavaScript(
    `document.getElementById('status').textContent = ${JSON.stringify(text)};` +
    `document.getElementById('dot').style.background = ${JSON.stringify(color)};`
  ).catch(() => {});
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 220,
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
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .dot {
    width:8px; height:8px; border-radius:50%; background:#38bdf8;
    animation: pulse 1.6s ease-in-out infinite;
  }
  .title  { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#a1a1aa; }
  .status { font-size:10px; color:#71717a; min-height:14px; transition: color .3s; }
  .row    { display:flex; align-items:center; gap:8px; }
</style>
</head>
<body>
  <div class="row"><div class="dot" id="dot"></div><span class="title">SprintLab</span></div>
  <div class="status" id="status">Initialising…</div>
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
    mainWindow.loadURL(frontendURL);
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
    setSplashStatus('Starting analysis engine…', 'blue');
    startBackend();
    setSplashStatus('Loading pose engine…', 'blue');
    try {
      await waitForBackend();
    } catch (err) {
      console.error(err.message);
      setSplashStatus('Pose engine failed to start — check logs', 'red');
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Serve frontend over HTTP so the page gets a real origin.
    // file:// gives a null opaque origin that breaks FFmpeg WASM blob URLs.
    const distDir = path.join(__dirname, '../frontend/dist');
    const port = await startStaticServer(distDir);
    frontendURL = `http://127.0.0.1:${port}`;
  }

  createMainWindow();

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });

  ipcMain.on('exit-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(false);
  });

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
