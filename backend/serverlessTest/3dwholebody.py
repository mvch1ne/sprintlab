import cv2
import os
import pandas as pd
import time
from collections import deque

from rtmlib import PoseTracker, Wholebody3d, draw_skeleton

device = "cpu"
backend = "onnxruntime"

input_file = "./videos/track_test.webm"

cap = cv2.VideoCapture(input_file)

# ⭐ Wholebody 3D tracker (important for stability)
wholebody3d = PoseTracker(
    Wholebody3d,
    det_frequency=1,
    tracking=False,
    backend=backend,
    device=device,
)

# Video properties
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

if fps <= 0:
    fps = 30

# Output paths
base_name = os.path.splitext(os.path.basename(input_file))[0]

os.makedirs("./output", exist_ok=True)

video_output_path = f"./output/{base_name}_processed_3d.avi"
data_output_path = f"./output/{base_name}_keypoints_3d.csv"

fourcc = cv2.VideoWriter_fourcc(*"MJPG")
out = cv2.VideoWriter(video_output_path, fourcc, fps, (width, height))

# Timing helper
def format_seconds(seconds):
    seconds = int(seconds)
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60

    if hrs > 0:
        return f"{hrs}h {mins}m {secs}s"
    elif mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"

print(f"Processing video: {base_name}")
print(f"Total frames: {total_frames}")
print("-" * 70)

frame_idx = 0
records = []

start_time = time.time()
fps_window = deque(maxlen=30)

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    frame_idx += 1
    frame_start = time.time()

    # ⭐ Wholebody 3D inference
    keypoints, scores, keypoints_simcc, keypoints_2d = wholebody3d(frame)

    record = {"frame": frame_idx}

    # ⭐ Save 3D + 2D pose data
    if len(keypoints) > 0:
        kp3d = keypoints[0]       # (num_kpts, 3)
        sc = scores[0]
        kp2d = keypoints_2d[0]

        for i, (p3, p2, conf) in enumerate(zip(kp3d, kp2d, sc)):
            record[f"x_3d_{i}"] = float(p3[0])
            record[f"y_3d_{i}"] = float(p3[1])
            record[f"z_3d_{i}"] = float(p3[2])

            record[f"x_2d_{i}"] = float(p2[0])
            record[f"y_2d_{i}"] = float(p2[1])

            record[f"s_{i}"] = float(conf)

    records.append(record)

    # ⭐ Draw 2D skeleton for visualization
    img_show = frame.copy()
    img_show = draw_skeleton(
        img_show,
        keypoints_2d,
        scores,
        kpt_thr=0.5
    )

    out.write(img_show)

    # ⭐ Performance monitoring
    frame_time = time.time() - frame_start
    fps_window.append(frame_time)

    if len(fps_window) > 0:
        avg_frame_time = sum(fps_window) / len(fps_window)
        real_fps = 1.0 / avg_frame_time if avg_frame_time > 0 else 0
    else:
        real_fps = 0

    elapsed = time.time() - start_time
    remaining_frames = total_frames - frame_idx
    eta_seconds = remaining_frames / real_fps if real_fps > 0 else 0

    progress = (frame_idx / total_frames) * 100 if total_frames > 0 else 0

    print(
        f"\rFrame {frame_idx}/{total_frames} | "
        f"Progress: {progress:.2f}% | "
        f"FPS: {real_fps:.2f} | "
        f"Elapsed: {format_seconds(elapsed)} | "
        f"ETA: {format_seconds(eta_seconds)}",
        end="",
        flush=True
    )

cap.release()
out.release()

pd.DataFrame(records).to_csv(data_output_path, index=False)

total_time = time.time() - start_time

print(f"\n\n✅ Processing complete!")
print(f"📁 Video → {video_output_path}")
print(f"📊 Data → {data_output_path}")
print(f"⏱ Total time → {format_seconds(total_time)}")