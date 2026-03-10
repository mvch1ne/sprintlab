# Backend Overview

**File:** `backend/server.py`

The backend is a lean FastAPI application. Its sole job is to accept a video file, run pose estimation on every frame, and stream the results back to the browser. It contains no business logic — all metric computation happens on the frontend.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | FastAPI (async) |
| Pose estimation | RTMLib — MMPose Wholebody3d |
| Video I/O | OpenCV (`cv2`) |
| Inference runtime | ONNX Runtime (CPU) |
| Transport | Server-Sent Events (SSE) |

## Startup

On startup, the server initialises the pose tracker once:

```python
tracker = PoseTracker(
    Wholebody3d,
    det_frequency=7,   # re-run detection every 7 frames; track between
    tracking=False,
    backend="onnxruntime",
    device="cpu",
)
```

`det_frequency=7` means the person detector runs every 7 frames and tracking propagates the bounding box in between. This is a performance trade-off: full detection on every frame is more accurate but significantly slower on CPU.

A warmup pass is run immediately after initialisation to avoid cold-start latency on the first real video:

```python
blank = np.zeros((64, 64, 3), dtype=np.uint8)
tracker(blank)
```

## CORS

CORS is configured to allow all origins:

```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

This is appropriate for local use (browser and server on the same machine). If deploying to a remote server, restrict `allow_origins` to your frontend's actual origin.

## Temporary File Handling

Uploaded videos are written to a system temp file with the original file extension preserved. The temp file is always deleted in a `finally` block after streaming completes, even if inference fails midway.

## Model Weights

RTMLib downloads ONNX model weights on first run and caches them locally. The Wholebody3d model is larger than the standard body-only models — expect a download of several hundred MB on first startup.
