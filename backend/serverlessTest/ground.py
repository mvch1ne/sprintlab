import cv2
import os
import csv
import time
import numpy as np
from collections import deque
from rtmlib import PoseTracker, Wholebody3d, draw_skeleton

# ----------------------------
# Settings
# ----------------------------
device = "cpu"  # or "cpu"
backend = "onnxruntime"

input_file = "./videos/hadid.mp4"
output_dir = "./output"

os.makedirs(output_dir, exist_ok=True)

base_name = os.path.splitext(os.path.basename(input_file))[0]
video_output = f"{output_dir}/{base_name}_processed.avi"
csv_output = f"{output_dir}/{base_name}_keypoints.csv"

# ----------------------------
# Video input/output
# ----------------------------
cap = cv2.VideoCapture(input_file)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

fourcc = cv2.VideoWriter_fourcc(*"MJPG")
out = cv2.VideoWriter(video_output, fourcc, fps, (width, height))

# ----------------------------
# Model
# ----------------------------
wholebody3d = PoseTracker(
    Wholebody3d,
    det_frequency=7,
    tracking=False,
    backend=backend,
    device=device,
)

# ----------------------------
# Simple ankle contact detection
# ----------------------------
history = 3
l_ank_y = deque(maxlen=history)
r_ank_y = deque(maxlen=history)
last_left = -10
last_right = -10

LEFT_HIP = 1
RIGHT_HIP = 2
LEFT_ANKLE = 5
RIGHT_ANKLE = 6
NUM_JOINTS = 17

def detect_contact(y_hist, frame_idx, last_contact):
    if len(y_hist) < 2:
        return False, last_contact
    vy = y_hist[-1] - y_hist[-2]
    contact = abs(vy) < 1.5 and (frame_idx - last_contact) > 5
    return contact, frame_idx if contact else last_contact

# ----------------------------
# CSV logging
# ----------------------------
csv_file = open(csv_output, "w", newline="")
writer = csv.writer(csv_file)
header = ["frame"] + [f"x3d_{i} y3d_{i} z3d_{i}" for i in range(NUM_JOINTS)] + ["left_contact", "right_contact"]
writer.writerow(header)

# ----------------------------
# Processing loop
# ----------------------------
start_time = time.time()
frame_idx = 0

print(f"Processing video: {base_name} ({total_frames} frames)")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break
    frame_idx += 1

    # Wholebody3d inference
    keypoints, scores, keypoints_simcc, keypoints_2d = wholebody3d(frame)

    left_contact = False
    right_contact = False

    if len(keypoints) > 0:
        kp3d = keypoints[0]
        kp2d = keypoints_2d[0]

        # Update ankle buffers
        l_ank_y.append(kp2d[LEFT_ANKLE][1])
        r_ank_y.append(kp2d[RIGHT_ANKLE][1])

        # Detect contacts
        left_contact, last_left = detect_contact(l_ank_y, frame_idx, last_left)
        right_contact, last_right = detect_contact(r_ank_y, frame_idx, last_right)

        # Draw skeleton
        img_show = draw_skeleton(frame.copy(), kp2d, scores, kpt_thr=0.5)

        # Draw contact markers
        if left_contact:
            x, y = int(kp2d[LEFT_ANKLE][0]), int(kp2d[LEFT_ANKLE][1])
            cv2.circle(img_show, (x, y), 8, (0,0,255), -1)
        if right_contact:
            x, y = int(kp2d[RIGHT_ANKLE][0]), int(kp2d[RIGHT_ANKLE][1])
            cv2.circle(img_show, (x, y), 8, (255,0,0), -1)

        # Write CSV
        row = [frame_idx] + [coord for joint in kp3d for coord in joint] + [int(left_contact), int(right_contact)]
        writer.writerow(row)

    else:
        img_show = frame.copy()

    out.write(img_show)

    # Terminal progress
    progress = (frame_idx / total_frames) * 100 if total_frames > 0 else 0
    elapsed = time.time() - start_time
    print(f"\rFrame {frame_idx}/{total_frames} | {progress:.2f}% | Elapsed: {int(elapsed)}s", end="", flush=True)

# ----------------------------
# Cleanup
# ----------------------------
cap.release()
out.release()
csv_file.close()

total_time = int(time.time() - start_time)
print(f"\n\n✅ Done! Video → {video_output} | CSV → {csv_output} | Time → {total_time}s")