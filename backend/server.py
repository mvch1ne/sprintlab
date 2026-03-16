import cv2
import time
import json
import numpy as np
from collections import deque
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import tempfile, os

from rtmlib import PoseTracker, Wholebody3d

app = FastAPI()
print('Hello')
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise tracker once at startup
tracker = PoseTracker(
    Wholebody3d,
    det_frequency=7,
    tracking=False,
    backend="onnxruntime",
    device="cpu",
)

# Warmup
blank = np.zeros((64, 64, 3), dtype=np.uint8)
tracker(blank)
print("✅ Wholebody3d ready")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/infer/video")
async def infer_video(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    def stream():
        try:
            cap = cv2.VideoCapture(tmp_path)

            fps          = cap.get(cv2.CAP_PROP_FPS)
            width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            if fps <= 0:
                fps = 30.0

            frames_data = []
            frame_idx   = 0
            start_time  = time.time()
            fps_window  = deque(maxlen=30)

            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break

                frame_start = time.time()

                # Wholebody3d returns: keypoints_3d, scores, keypoints_simcc, keypoints_2d
                keypoints_3d, scores, _simcc, keypoints_2d = tracker(frame)

                # Wire format per frame:
                # 2D section: [x0,y0,s0,  x1,y1,s1,  ...] for all N keypoints
                # 3D section: [x0,y0,z0,  x1,y1,z1,  ...] for all N keypoints
                # Packed as a single flat list: 2D first, then 3D.
                # Frontend splits at index N*3 to recover both.
                if len(keypoints_2d) > 0 and len(keypoints_3d) > 0:
                    kp2 = keypoints_2d[0]   # (N, 2)
                    kp3 = keypoints_3d[0]   # (N, 3)
                    sc  = scores[0]         # (N,)

                    flat2d = []
                    for (x, y), s in zip(kp2, sc):
                        flat2d.extend([float(x), float(y), float(s)])

                    flat3d = []
                    for (x, y, z) in kp3:
                        flat3d.extend([float(x), float(y), float(z)])

                    flat = flat2d + flat3d
                    n_kpts = len(sc)
                else:
                    # No detection — zeros. Will be filled client-side.
                    n_kpts = 133          # Wholebody3d keypoint count
                    flat   = [0.0] * (n_kpts * 3 + n_kpts * 3)

                frames_data.append(flat)

                frame_time = time.time() - frame_start
                fps_window.append(frame_time)
                elapsed = time.time() - start_time

                avg_frame_time = sum(fps_window) / len(fps_window)
                real_fps       = 1.0 / avg_frame_time if avg_frame_time > 0 else 0
                remaining      = total_frames - frame_idx - 1
                eta            = remaining / real_fps if real_fps > 0 else 0
                pct            = round((frame_idx + 1) / total_frames * 100, 1) if total_frames > 0 else 0

                yield f"data: {json.dumps({'type': 'progress', 'frame': frame_idx, 'total': total_frames - 1, 'pct': pct, 'fps': round(real_fps, 2), 'elapsed': round(elapsed, 1), 'eta': round(eta, 1)})}\n\n"

                frame_idx += 1

            cap.release()

            yield f"data: {json.dumps({'type': 'result', 'fps': fps, 'frame_width': width, 'frame_height': height, 'total_frames': len(frames_data), 'n_kpts': n_kpts, 'frames': frames_data})}\n\n"

        finally:
            os.unlink(tmp_path)

    return StreamingResponse(stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)