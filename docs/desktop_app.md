# Desktop Application

SprintLab ships as a native desktop application built with [Electron](https://www.electronjs.org/). The desktop version bundles the Python backend into a single installable package — no separate server setup required.

## Download

Pre-built installers are available on the [GitHub Releases page](https://github.com/mvch1ne/sprintlab/releases).

| Platform | File | Notes |
|----------|------|-------|
| Windows | `SprintLab Setup x.x.x.exe` | NSIS installer |
| macOS | `SprintLab-x.x.x.dmg` | Build from source (see below) |
| Linux | `SprintLab-x.x.x.AppImage` | Build from source (see below) |

---

## Startup sequence

When launched in production, the app goes through the following stages before the main window appears:

1. **Splash screen appears** — a small frameless window shows while the backend loads
2. **Backend starts** — the bundled `SprintLabBackend` binary is spawned as a child process
3. **Health check loop** — main process polls `http://localhost:8000/health` every second (up to 120s)
4. **Static server starts** — a local HTTP server serves `frontend/dist/` on a random port with COOP/COEP headers
5. **Main window opens** — once the backend is healthy, the splash closes and the app loads from `http://127.0.0.1:<port>`

### Splash screen status messages

The splash screen updates in real time as startup progresses:

| Message | Meaning |
|---------|---------|
| `Initialising…` | Splash just opened |
| `Starting analysis engine…` | Backend binary is being spawned |
| `Loading pose engine… Xs` | Waiting for health check, X = elapsed seconds |
| `Pose engine ready` (green) | Backend responded healthy |
| `Pose engine failed to start — check logs` (red) | Health check timed out after 120s |

If the backend fails to start the app still opens — errors will appear in the UI when you try to run pose analysis.

> **Why does startup take so long?** On first launch the backend loads two ONNX models into memory before the FastAPI server starts accepting requests. On a typical machine this takes 30–90 seconds. Subsequent launches are faster once the models are cached.

---

## Running in Development

The splash screen and backend auto-start are skipped in dev mode. Run them manually:

```bash
# Terminal 1 — Python backend
cd backend
uvicorn server:app --port 8000 --reload

# Terminal 2 — Electron + Vite
npm install        # root (first time only)
npm run electron:dev
```

Electron loads the Vite dev server at `http://localhost:5173` and hot-reloads on file changes.

---

## Building from Source

### Prerequisites (all platforms)

- Node.js ≥ 20
- Python ≥ 3.10 + pip
- PyInstaller: `pip install pyinstaller`

### Step 1 — Build the Python backend binary

> **Windows:** Run this step in a **non-administrator** terminal. PyInstaller will warn and eventually block execution when run as admin. Only Step 2 (electron:build) needs Administrator.

```bash
# Windows
cd backend && build_backend.bat

# macOS / Linux
cd backend && ./build_backend.sh
```

Output:
- **Windows:** `backend/dist/SprintLabBackend.exe`
- **macOS / Linux:** `backend/dist/SprintLabBackend`

> **Important:** `server.py` must include `uvicorn.run()` under `if __name__ == "__main__"` — this is what starts the server when the binary runs. Without it, the binary loads the models and exits immediately. The `uvicorn server:app` CLI used in dev mode bypasses this block, so dev mode is unaffected.

### Step 2 — Copy FFmpeg WASM files and package

FFmpeg runs locally inside the app (no internet required). The WASM files are not committed to the repo but are available after `npm install --prefix frontend` since `@ffmpeg/core` is a dev dependency. Copy them then build — run as a single chained command:

> **Windows:** Run your terminal **as Administrator**. electron-builder needs symlink privileges for its code-signing tools — without it the NSIS installer step will fail with a `Cannot create symbolic link` error.

**Windows CMD:**
```
copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.js frontend\public\ffmpeg\ && copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.wasm frontend\public\ffmpeg\ && npm run electron:build
```

**macOS / Linux:**
```bash
cp frontend/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js frontend/public/ffmpeg/ && cp frontend/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm frontend/public/ffmpeg/ && npm run electron:build
```

Output in `dist-electron/`:

| Platform | Output |
|----------|--------|
| Windows | `SprintLab Setup x.x.x.exe` |
| macOS | `SprintLab-x.x.x.dmg` |
| Linux | `SprintLab-x.x.x.AppImage` |

> **Note:** Each platform must be built on its own OS. You cannot cross-compile (e.g., build a macOS `.dmg` on Windows).

### Step 3 — Publish to GitHub Releases

Requires the [GitHub CLI](https://cli.github.com/) (`gh`). Install it if you haven't already:

```bash
# Windows (if winget shows an msstore error, ignore it — use --source winget explicitly)
winget install GitHub.cli --source winget

# macOS
brew install gh

# Linux
sudo apt install gh   # Debian/Ubuntu
```

> **Windows:** After installing, **close and reopen your terminal** so the PATH update takes effect before running `gh`.

Then authenticate once:

```bash
gh auth login
```

Run from the project root.

**macOS / Linux (bash — backslash line continuation works):**
```bash
gh release create v1.0.0 \
  "dist-electron/SprintLab Setup 1.0.0.exe" \
  --title "SprintLab v1.0.0" \
  --notes "Windows installer. macOS and Linux users: build from source (see README)."
```

**Windows CMD (must be a single line — no backslash continuation):**
```
gh release create v1.0.0 "dist-electron/SprintLab Setup 1.0.0.exe" --title "SprintLab v1.0.0" --notes "Windows installer. macOS and Linux users: build from source (see README)."
```

This uploads the installer as a downloadable asset on the [Releases page](https://github.com/mvch1ne/sprintlab/releases). Update the version tag and filename to match your actual build output.

---

## Architecture

```
Electron main process (electron/main.js)
│
├── Creates splash window (frameless, shows startup status)
├── Spawns Python backend binary (resources/backend/SprintLabBackend[.exe])
├── Polls http://localhost:8000/health — updates splash with elapsed time
├── Starts local HTTP server on a random port (serves frontend/dist/ with COOP/COEP headers)
├── On ready: closes splash, creates main BrowserWindow
└── Loads http://127.0.0.1:<port>/index.html
```

The frontend communicates with the backend over `http://localhost:8000` — the same API as the web version.

### Why a local HTTP server instead of file://?

Electron can load the frontend directly from disk via `file://`, but `file://` gives the page a **null (opaque) origin**. This breaks FFmpeg WASM: the library creates a blob-URL Worker that tries to `fetch()` a blob-URL WASM file. In Chromium, blob URLs created from a null origin each get their own unique opaque origin — so the Worker and the WASM blob appear cross-origin to each other and the fetch silently hangs forever.

By serving `frontend/dist/` from a lightweight Node.js `http` server (built-in, no dependencies), the page loads from `http://127.0.0.1:<port>` — a **real origin**. Blob URLs inherit this origin, the Worker can fetch the WASM, and everything works exactly as it does in dev mode.

The static server also sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response, which enables `SharedArrayBuffer` (required by FFmpeg WASM). A session-level header interceptor provides the same headers in dev mode.

### FFmpeg WASM

FFmpeg runs entirely in the renderer process (no server involvement). The WASM files are copied from `@ffmpeg/core` into `frontend/public/ffmpeg/` before building, and Vite includes them in `frontend/dist/ffmpeg/`. In the packaged app they are served by the local HTTP server at the same origin.

**In Electron (packaged):** `useFFmpeg.ts` detects Electron via `window.electronAPI` and loads the WASM files from `window.location.origin + '/ffmpeg/'` using `toBlobURL`. Since the page has a real HTTP origin, the blob URLs created by `toBlobURL` inherit that origin and FFmpeg's internal Worker can fetch them without cross-origin issues.

**In the browser (web / dev mode):** the page loads from `http://localhost:5173` (a real origin). Files are fetched from the unpkg CDN via `toBlobURL` — the standard approach.

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `fullscreen-change` | main → renderer | Notifies renderer when fullscreen state changes |
| `exit-fullscreen` | renderer → main | Requests the window to exit fullscreen |

### Preload API (`window.electronAPI`)

| Method | Type | Purpose |
|--------|------|---------|
| `onFullscreenChange(cb)` | event | Fires when window enters or exits fullscreen |
| `exitFullscreen()` | call | Tells main process to exit fullscreen |
| `readResourceFile(path)` | call | Reads a file from `resources/` via Node.js `fs`, returns `ArrayBuffer` — available for any resource file outside the asar |

---

## Fullscreen

Press **F11** (Windows/Linux) or **Ctrl+Cmd+F** (macOS) to toggle fullscreen.

When in fullscreen mode an **Exit Fullscreen · F11** button appears in the header, so you can always get out without remembering the shortcut.

---

## Troubleshooting

### Splash says "Pose engine failed to start"

The backend binary started but didn't respond to the health check within 120 seconds. Steps to diagnose:

1. **Run the binary directly from a terminal** — navigate to the install directory and run:
   ```
   # Find the binary
   where /R "%LOCALAPPDATA%\Programs\SprintLab" SprintLabBackend.exe

   # Run it
   "C:\Users\<you>\AppData\Local\Programs\SprintLab\resources\backend\SprintLabBackend.exe"
   ```
   The terminal will show the startup output and any errors. A healthy startup looks like:
   ```
   Hello
   load ...\yolox_m_8xb8-300e_humanart-c2c7a14a.onnx with onnxruntime backend
   load ...\rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx with onnxruntime backend
   ✅ Wholebody3d ready
   INFO:     Started server process [...]
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **If the binary exits immediately after "Wholebody3d ready"** — `server.py` is missing the `uvicorn.run()` entrypoint. Ensure the bottom of `server.py` contains:
   ```python
   if __name__ == "__main__":
       import uvicorn
       uvicorn.run(app, host="0.0.0.0", port=8000)
   ```
   Then rebuild the backend binary and repackage the app.

3. **If antivirus blocks it** — Windows Defender or other AV software may silently kill PyInstaller binaries. Add an exclusion for the install directory or sign the binary.

4. **If port 8000 is already in use** — another process is using port 8000. Find and stop it:
   ```
   netstat -ano | findstr :8000
   taskkill /PID <pid> /F
   ```

### App is stuck on "Analysing FPS" after uploading a video

FFmpeg WASM failed to load. The WASM files must be present in `frontend/dist/ffmpeg/` so the local HTTP server can serve them to the renderer.

**1. WASM files not copied before building** — the copy step was skipped. The files need to be in `frontend/public/ffmpeg/` before `npm run electron:build` (Vite copies `public/` into `dist/`). Re-run the full build command:
```
copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.js frontend\public\ffmpeg\ && copy frontend\node_modules\@ffmpeg\core\dist\esm\ffmpeg-core.wasm frontend\public\ffmpeg\ && npm run electron:build
```

**2. Page loaded from `file://` instead of the static server** — if `electron/main.js` loads the frontend via `loadFile()` instead of `loadURL(frontendURL)`, the page gets a null origin and blob URLs break. Ensure the production path uses the local HTTP server (see Architecture above).
