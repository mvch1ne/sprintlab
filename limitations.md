# SprintLab — Limitations & Improvement Paths

## Improvable Limitations

### 1. Null-Filling Creates Freeze-Snap Artifacts

**Problem:** When a keypoint drops below the 0.35 confidence threshold, the last valid value is forward-filled. During fast movements — exactly when occlusion is most likely — this creates an artificial hold followed by a sudden jump. Downstream derivatives read this as zero velocity then a sharp spike, corrupting angular velocity and acceleration data at the moments that matter most.

**Fix:** Replace forward-fill with a per-keypoint Kalman filter. The confidence scores already available from RTMLib map directly to observation noise variance — low confidence means the filter leans on its constant-velocity (or constant-acceleration) motion model instead of freezing. This produces smooth trajectories through occlusion, eliminates the snap artifact, and improves every downstream metric. Implementation lives entirely in `sprintMath.ts` with no backend or UX changes.

### 2. Hip-Midpoint CoM Approximation

**Problem:** Center of mass is computed as the midpoint of the left and right hip landmarks. Real CoM depends on the mass-weighted positions of all body segments. During sprinting, asymmetric limb positions (one leg in full extension behind the body, the other in recovery) shift the true CoM significantly from the hip midpoint — especially during flight phase. CoM speed, acceleration, and cumulative distance all inherit this error.

**Fix:** Implement a segmental CoM model using standard anthropometric mass fractions (e.g. Dempster or de Levi tables: trunk ~43%, thigh ~10%, shank ~4.6%, upper arm ~2.7%, etc.). Compute each segment's centroid from its bounding keypoint pair, weight by mass fraction, and sum. All required keypoints are already tracked. This is a single pure function operating on existing data — no model changes, no new inference.

### 3. Fixed Smoothing Attenuates Peak Signal

**Problem:** The double box filter (w=3) followed by central-difference differentiation and another box smooth creates an effective triangular kernel that introduces phase lag and significantly damps high-frequency content. Angular velocities and accelerations during the sharpest mechanical events — knee extension at toe-off, hip flexion entering recovery — are exactly what gets attenuated. The fixed window also ignores frame rate: the same kernel at 30fps and 120fps produces very different effective bandwidths.

**Fix:** Replace the box filter with a Savitzky-Golay filter, which fits a local polynomial and preserves peak shape while still suppressing noise. Make the window width fps-adaptive: wider at low frame rates (more noise per mechanical event), narrower at high frame rates. Same computational complexity, substantially better preservation of the transient dynamics that define sprint technique.

### 4. Frame-Rate-Limited Contact Timing

**Problem:** Ground contact detection relies on the foot's y-coordinate crossing a threshold. At 30fps each frame spans ~33ms. Elite sprint ground contacts are 80–100ms, meaning a contact event is resolved by roughly 3 frames. Touchdown and toe-off timing are quantized to ±33ms, which is a large fraction of the event itself.

**Fix:** Fit a cubic spline to the foot y-trajectory in a window around each threshold crossing and solve for the sub-frame crossing point analytically. This won't match 1000Hz force-plate precision, but it can improve effective resolution from ~33ms quantization to roughly 5–10ms — a meaningful gain for a metric athletes actually use to guide training.

### 5. Uniform Spatial Calibration Assumes No Perspective

**Problem:** A single reference line produces a single pixels-per-metre value applied uniformly across the frame. This is only correct if the camera is orthogonal to the plane of motion and the athlete stays at constant depth. Any camera angle or depth change makes the scale factor wrong — objects farther from the camera appear smaller, and the system has no way to account for this.

**Fix:** Request two reference lines at different known positions in the scene (e.g. lane width plus a known longitudinal marking). Two correspondences enable a ground-plane homography estimation that corrects for perspective foreshortening. This is a moderate UX change (an extra calibration step) but not a hard math problem, and it substantially improves distance accuracy for non-ideal camera setups.

---

## Fundamental Limitations

### 6. Monocular 2D Projection

This is the deepest constraint and it is not fixable within the current paradigm. Every spatial measurement is a projection of 3D motion onto the 2D camera plane. Out-of-plane motion is either invisible or appears as a distorted version of itself.

For sprinting, this has specific consequences. Pelvic rotation — a key indicator of hip extension quality and asymmetry — produces almost no signal in the sagittal projection. Arm swing depth is invisible. Foot placement width (step width), which matters for lateral force application and injury risk, cannot be measured. Any time the camera is not perfectly perpendicular to the direction of travel, all sagittal-plane measurements (joint angles, segment inclinations, step length) are foreshortened by the cosine of the offset angle. A 15° camera misalignment produces a ~3.4% error in distances and subtly distorts angles.

The only real solutions require additional information about the scene's third dimension: a second camera at a different angle (stereo reconstruction), a depth sensor (LiDAR, structured light), or a learned monocular depth estimation model. Each of these introduces its own complexity and error budget. Stereo reconstruction requires camera synchronization and calibration. Depth sensors have limited outdoor range. Learned depth models are improving rapidly but are not yet reliable enough for sub-centimetre biomechanics.

This is a hard boundary. Within it, angular metrics are the most robust outputs (angles between segments in the camera plane are relatively insensitive to small depth errors), while distance-based and velocity-based metrics should be understood as projections, not true 3D quantities.

### 7. No Temporal Model in Pose Estimation

Each frame is processed independently by RTMLib. There is no motion prior, no optical flow coupling, and no temporal consistency enforcement at the keypoint detection stage. The system relies entirely on post-hoc smoothing in the math layer to produce coherent trajectories.

This means the raw keypoint data is noisier than it needs to be — especially for fast-moving extremities where single-frame detection is most uncertain. A proper temporal model (recurrent pose estimation, or at minimum a pose-tracking-by-detection pipeline that enforces temporal coherence) would improve raw keypoint quality before any math is applied. However, this requires either a different pose estimation model or a significant post-processing pipeline between inference and the metrics engine. It's architecturally invasive and depends on the availability of suitable temporal pose models that run at acceptable speed on CPU via ONNX. The Kalman filter fix described above is the pragmatic approximation of this — it adds a temporal model after detection rather than during it.

### 8. Single Fixed Camera, No Panning Support

SprintLab assumes a static camera with the athlete moving through the field of view. A panning camera would require frame-by-frame homography estimation (using background feature tracking to separate camera motion from athlete motion) and continuous recalibration of the spatial scale as the camera-to-athlete geometry changes.

This is solvable in principle — background feature detection, RANSAC homography, and per-frame scale adjustment are well-understood techniques — but it's a substantial engineering effort that introduces a new class of error (misestimated camera motion propagates into every spatial metric). For the current use case of filming a sprint from a fixed tripod position, this limitation is acceptable. It becomes a real constraint for longer events or for footage where the camera operator tracks the athlete.

### 9. No Lens Distortion Correction

Wide-angle and smartphone lenses introduce barrel distortion that curves straight lines, especially near frame edges. SprintLab applies no distortion correction, so keypoints detected near the frame periphery have slightly wrong positions. The error is typically small for modern smartphone lenses at reasonable filming distances, but it's non-zero and it's systematic — it biases distance measurements in a consistent direction depending on where in the frame the athlete is.

Correction is possible (camera intrinsic calibration via checkerboard patterns, or lookup by device model) but adds significant UX friction for a relatively small accuracy gain in typical use cases. It becomes more important if the system is ever used with action cameras or wide-angle lenses.
