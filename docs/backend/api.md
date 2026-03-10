# API Reference

The backend exposes two HTTP endpoints.

---

## `GET /health`

Readiness probe. Returns immediately once the server is up and the model is warmed up.

**Response**

```json
{ "status": "ok" }
```

**Usage**

The frontend polls this endpoint on page load until it receives a `200` response before enabling the upload button. This handles the cold-start delay when model weights are being loaded or downloaded.

---

## `POST /infer/video`

Runs Wholebody3d pose estimation on every frame of the uploaded video and streams results as Server-Sent Events.

**Request**

```
Content-Type: multipart/form-data
Body: file=<video file>
```

The file field must be named `file`. Any video format supported by OpenCV is accepted (MP4, MOV, AVI, etc.).

**Response**

```
Content-Type: text/event-stream
```

The response body is a stream of SSE events. Each event is a line of the form:

```
data: <JSON>\n\n
```

### Progress event

Emitted after each frame is processed.

```json
{
  "type": "progress",
  "frame": 42,
  "total": 299,
  "pct": 14.0,
  "fps": 12.3,
  "elapsed": 3.4,
  "eta": 20.8
}
```

| Field | Type | Description |
|---|---|---|
| `frame` | `int` | Zero-based index of the frame just processed |
| `total` | `int` | Total number of frames in the video |
| `pct` | `float` | Percentage complete (0–100) |
| `fps` | `float` | Current inference throughput (frames per second) |
| `elapsed` | `float` | Seconds elapsed since inference started |
| `eta` | `float` | Estimated seconds remaining |

### Result event

Emitted once, after all frames have been processed.

```json
{
  "type": "result",
  "fps": 120.0,
  "frame_width": 1920,
  "frame_height": 1080,
  "total_frames": 300,
  "n_kpts": 133,
  "frames": [[...], [...], ...]
}
```

| Field | Type | Description |
|---|---|---|
| `fps` | `float` | Video frame rate from container metadata |
| `frame_width` | `int` | Inference frame width (pixels) |
| `frame_height` | `int` | Inference frame height (pixels) |
| `total_frames` | `int` | Number of frames in `frames` array |
| `n_kpts` | `int` | Number of keypoints per person (133 for Wholebody3d) |
| `frames` | `float[][]` | Per-frame keypoint data (see below) |

### Frame data format

Each element of `frames` is a flat `float[]` of length `n_kpts × 6`:

```
Index 0           … n_kpts×3 - 1    2D section
Index n_kpts×3    … n_kpts×6 - 1    3D section
```

**2D section** (`n_kpts × 3` values): `[x0, y0, s0, x1, y1, s1, ...]`

- `x`, `y` — keypoint coordinates in inference-frame pixels
- `s` — confidence score in `[0, 1]`

**3D section** (`n_kpts × 3` values): `[x0, y0, z0, x1, y1, z1, ...]`

- 3D coordinates in the model's local coordinate system
- SprintLab currently uses only the 2D section for metric computation

### No-detection frame

If the model finds no person in a frame, a zero-filled array of the expected length is returned:

```python
flat = [0.0] * (n_kpts * 3 + n_kpts * 3)
```

The frontend handles this gracefully — zero-confidence keypoints are filtered out by the `score ≥ 0.35` threshold.

---

## Error handling

If OpenCV fails to open the video file, the stream will terminate without a `result` event. The frontend detects this (result event never arrives) and shows an error state.
