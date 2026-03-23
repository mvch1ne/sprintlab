# SprintLab — Limitations & Improvement Paths

## Validation

SprintLab currently has no ground-truth validation against lab-grade instrumentation. Every metric in this document — joint angles, contact times, CoM trajectory, step lengths, and all proxy metrics — has an unknown error budget. Without validation data, it is not possible to confidently state which metrics are reliable enough for training decisions and which are directional estimates at best.

**Opportunity:** Dr. Marcus Schmidt at TU Dortmund University has offered to perform a validation study in their movement analysis lab. This would provide marker-based motion capture and force plate data as ground truth against SprintLab's monocular video estimates. This is a high-priority opportunity — a published validation study would establish error bounds on every metric, provide calibration targets for the automated S-MAS scoring thresholds (item #8), inform which improvements in this document to prioritize, and give SprintLab peer-reviewed credibility.

**Status:** Offered via LinkedIn. Reach out to Dr. Schmidt directly to begin scoping the study.

---

## Improvable Limitations

### 1. Null-Filling Creates Freeze-Snap Artifacts

**Problem:** When a keypoint drops below the 0.35 confidence threshold, the last valid value is forward-filled. During fast movements — exactly when occlusion is most likely — this creates an artificial hold followed by a sudden jump. Downstream derivatives read this as zero velocity then a sharp spike, corrupting angular velocity and acceleration data at the moments that matter most.

**Fix:** Replace forward-fill with a per-keypoint Kalman filter. The confidence scores already available from RTMLib map directly to observation noise variance — low confidence means the filter leans on its constant-velocity (or constant-acceleration) motion model instead of freezing. This produces smooth trajectories through occlusion, eliminates the snap artifact, and improves every downstream metric. Implementation lives entirely in `sprintMath.ts` with no backend or UX changes.

### 2. Hip-Midpoint CoM Approximation

**Problem:** Center of mass is computed as the midpoint of the left and right hip landmarks. Real CoM depends on the mass-weighted positions of all body segments. During sprinting, asymmetric limb positions (one leg in full extension behind the body, the other in recovery) shift the true CoM significantly from the hip midpoint — especially during flight phase. CoM speed, acceleration, and cumulative distance all inherit this error.

**Fix:** Implement a segmental CoM model using standard anthropometric mass fractions (e.g. Dempster or de Levi tables: trunk ~43%, thigh ~10%, shank ~4.6%, upper arm ~2.7%, etc.). Compute each segment's centroid from its bounding keypoint pair, weight by mass fraction, and sum. All required keypoints are already tracked. This is a single pure function operating on existing data — no model changes, no new inference.

### 3. Fixed Smoothing Attenuates Peak Signal

**Problem:** The double box filter (w=3) followed by central-difference differentiation and another box smooth creates an effective triangular kernel that introduces phase lag and significantly damps high-frequency content. Angular velocities and accelerations during the sharpest mechanical events — knee extension at toe-off, hip flexion entering recovery — are exactly what gets attenuated. The fixed window also ignores frame rate: the same kernel at 30fps and 120fps produces very different effective bandwidths.

**Fix — joint angles and angular metrics:** Replace the box filter with a Savitzky-Golay filter, which fits a local polynomial and preserves peak shape while still suppressing noise. Make the window width fps-adaptive: wider at low frame rates (more noise per mechanical event), narrower at high frame rates. Same computational complexity, substantially better preservation of the transient dynamics that define sprint technique.

**Fix — CoM horizontal position and velocity (different problem, different solution):** CoM horizontal position during a sprint is not a general signal — it is monotonically increasing by physics. This constraint changes the optimal approach entirely. The recommended pipeline, validated empirically across 2,400 simulated runs at multiple noise levels and frame rates, is:

1. **Monotonicity pre-filter** — any frame where `x[i] < x[i-1]` is a physically impossible pose estimation artifact. Interpolate across it. This eliminates the noise conditions under which all smoothing methods degrade, and it is essentially free computationally.
2. **Smoothing spline + analytic derivative** — fit a smoothing spline to the cleaned position data and differentiate it analytically. This avoids numerical differentiation error entirely. Median velocity RMSE: 0.045 m/s, versus 0.186 m/s for Savitzky-Golay under the same conditions.
3. **Displacement constraint correction** — after computing the velocity curve, integrate it and compare to the known physical distance D between timing lines. Apply a uniform velocity offset to force `∫v(t)dt = D` exactly. This anchors the curve to independently measured physical reality without distorting the acceleration profile or peak velocity shape.

Do not use Savitzky-Golay for CoM horizontal velocity. It is the right tool for joint angles; it is the wrong tool here. See the Sprint Timing & Velocity Engineering Specification for the full implementation, including TypeScript and Python code.

### 4. Frame-Rate-Limited Contact Timing

**Problem:** Ground contact detection relies on the foot's y-coordinate crossing a threshold. At 30fps each frame spans ~33ms. Elite sprint ground contacts are 80–100ms, meaning a contact event is resolved by roughly 3 frames. Touchdown and toe-off timing are quantized to ±33ms, which is a large fraction of the event itself.

**Fix:** Fit a cubic spline to the foot y-trajectory in a window around each threshold crossing and solve for the sub-frame crossing point analytically. This won't match 1000Hz force-plate precision, but it can improve effective resolution from ~33ms quantization to roughly 5–10ms — a meaningful gain for a metric athletes actually use to guide training.

### 5. Uniform Spatial Calibration Assumes No Perspective

**Problem:** A single reference line produces a single pixels-per-metre value applied uniformly across the frame. This is only correct if the camera is orthogonal to the plane of motion and the athlete stays at constant depth. Any camera angle or depth change makes the scale factor wrong — objects farther from the camera appear smaller, and the system has no way to account for this.

**Fix:** Request two reference lines at different known positions in the scene (e.g. lane width plus a known longitudinal marking). Two correspondences enable a ground-plane homography estimation that corrects for perspective foreshortening. This is a moderate UX change (an extra calibration step) but not a hard math problem, and it substantially improves distance accuracy for non-ideal camera setups.

### 6. Wholebody3d Model Underutilization (Phase 1 — Near-Term)

**Problem:** The backend runs RTMLib's Wholebody3d model, which produces 133 keypoints in both 2D and 3D per frame. The metrics engine uses only 17 of those keypoints and only their 2D coordinates. This means:

- **116 keypoints are ignored.** The detailed foot landmarks (metatarsal keypoints) could provide forefoot vs. rearfoot contact patterns and a far more precise ground contact point than the current heel-and-toe max. Face landmarks could enable head stability analysis — a real coaching cue at elite level.
- **All 3D coordinates are discarded.** The wire format explicitly carries 3D data (`n_kpts × 6`), the frontend splits it out, and then never touches it. The 3D estimates could provide approximate pelvic rotation, arm swing depth, step width, and a substantially better CoM estimate — partially mitigating the monocular 2D limitation described below.

**Fix:** Rewrite the metrics engine to consume the full keypoint set. Prioritize:

1. Use 3D keypoints for all angle, distance, and CoM computations. Monocular 3D is noisier along the camera axis than laterally, but it is significantly better than pure 2D projection for out-of-plane quantities. Apply the Kalman filter (limitation #1) in 3D space.
2. Use detailed foot keypoints to improve contact detection — replace the two-point heel/toe model with a multi-point foot surface model that can distinguish forefoot, midfoot, and rearfoot contact.
3. Use face/head keypoints for head stability metrics.
4. Feed the richer keypoint set into the segmental CoM model (limitation #2) for a more anatomically accurate center of mass.

This is a metrics engine rewrite, not a model or backend change. The inference is already doing the work.

### 7. 3D Model Retargeting from Pose Data (Phase 2 — Long-Term)

**Problem:** The Wholebody3d output provides per-frame 3D joint positions, which is the standard input to a motion retargeting pipeline. SprintLab currently has no path from pose data to a rigged 3D character, which limits its value for immersive analysis, coaching visualization, and the planned AR/VR resimulation work.

**Fix:** Build an inverse kinematics pipeline that converts 3D keypoint positions into joint rotations and maps them onto a parametric body model (SMPL-X is the natural target, since it supports body, hands, and face — matching the wholebody output). Existing tooling (SMPLify-X, HybrIK, PyMAF) handles much of this conversion. Key challenges to solve:

- **Depth accuracy.** Monocular 3D estimation is weakest along the camera axis. Resimulations viewed from the original camera angle look correct; rotating the virtual camera 90° exposes depth compression. Quantify and communicate this uncertainty to the user.
- **Temporal coherence.** Frame-independent 3D estimates jitter. Joint rotations must be smoothed in rotation space (quaternion slerp or exponential map), not Euclidean space, to avoid mesh vibration artifacts.
- **Root motion recovery.** 3D keypoints are body-relative. Global translation per frame must be recovered from the calibration system and ground-plane estimation to move the character through world space.
- **Real-time playback.** The mesh deformation and rendering pipeline must run at interactive frame rates for the tool to be useful as a coaching interface.

This is a significant engineering effort that depends on Phase 1 being complete (the 3D keypoints must be fully integrated and temporally filtered before they can drive a character). It is integration work, not fundamental research — the individual components exist.

**Potential accelerator — MyoLab / MyoKinesis:** The CEO of MyoLab (myolab.ai) reached out directly with an offer of free credits to evaluate their MyoKinesis SDK. MyoKinesis is a motion reconstruction system claiming 29% higher fidelity and 13× faster performance than existing methods, built on top of physiologically grounded musculoskeletal models (MuJoCo-based, from a team that includes Emo Todorov). If their SDK works as described, it could replace the custom IK → SMPL-X pipeline outlined above and additionally provide the musculoskeletal layer (muscle activations, joint torques) that would otherwise require a separate OpenSim integration.

Blog post: https://myolab.ai/blog/myokinesis
Open-source model repo: https://github.com/myolab/myo_model
SDK access: https://github.com/myolab/myo_api

Before integrating, evaluate:

1. **Input format** — can it accept Wholebody3d 3D keypoints directly, or does it require raw video (which would mean redundant inference)?
2. **Output format** — does it return joint rotations, muscle activations, joint torques, or something proprietary? Can the output feed back into SprintLab's metrics engine?
3. **Sprint-specific fidelity** — their benchmarks are general motion. Sprint mechanics involve extreme joint velocities and very short ground contacts. Request validation data for high-speed athletic movements.
4. **Latency and cost** — batch or real-time? Per-video pricing at scale matters for the target user base.
5. **Licensing** — the open-source models are licensed for non-commercial research only. Commercial use likely requires a separate agreement. Clarify what the free credits cover and what happens after.

---

## Missing Features & Metrics

### 8. Automated S-MAS Scoring

The Sprint Mechanics Assessment Score (S-MAS) is a 12-item qualitative screening tool developed by Bramah et al. for field-based assessment of sprint mechanics associated with hamstring strain injury risk. It evaluates three domains: lumbar-pelvic control, backside mechanics, and overstride patterns. Each item is scored dichotomously (0 = optimal, 1 = suboptimal), producing a total from 0–12.

SprintLab already computes most of the underlying kinematics: anterior pelvic tilt (derivable from hip-trunk segment relationships), trunk flexion at touchdown (torso inclination), shin angle at contact (shin segment inclination), foot placement relative to CoM (already computed as foot-to-CoM offset), thigh extension past vertical (thigh segment angle), and backside knee flexion (knee angle during swing). The ground contact detection system already identifies the gait phases at which each item must be evaluated.

**Implementation:** Map each of the 12 S-MAS items to its kinematic threshold at the appropriate gait event (touchdown, mid-stance, toe-off, mid-swing). Evaluate automatically per stride, per side. Output a per-stride S-MAS score with item-level breakdown so the athlete can see which specific patterns are flagged. The hard part is threshold calibration — the S-MAS was designed for human raters making qualitative judgments, so the kinematic cutoffs need to be validated against manual scoring to ensure the automated version agrees with the clinical tool it's based on.

**Value:** This converts raw kinematic data into a clinically validated injury risk interpretation. Instead of showing numbers and leaving the athlete to figure out what they mean, SprintLab would flag specific mechanical patterns with established associations to hamstring strain injury.

### 9. Kinogram Generation

A kinogram is a composite image showing the athlete's body position at evenly spaced intervals across a stride cycle (or a specific phase like ground contact), overlaid on a single frame. It is one of the most widely used coaching visualization tools in sprinting — it gives an immediate visual read of posture progression, limb positions at key events, and overall movement quality that time-series data cannot convey as intuitively.

**Implementation:** Identify stride boundaries from the contact detection system. Sample frames at equal intervals across the stride (or at biomechanically meaningful events: touchdown, mid-stance, toe-off, max knee lift, etc.). For each sampled frame, render the skeleton overlay (already implemented in PoseOverlay) onto a single composite canvas. Use color gradation or opacity ramp to indicate temporal progression. Offer two modes: (1) automatic — evenly spaced across the stride cycle, and (2) event-locked — skeleton at specific gait events the user selects. Allow export as a standalone image.

**Value:** This is the single most requested analysis artifact in sprint coaching. A kinogram from SprintLab would be directly comparable to the manually-produced kinograms coaches currently spend significant time creating by hand in Photoshop or Dartfish.

### 10. Contact Length & Flight Distance

**Contact length** is the horizontal displacement of the CoM during ground contact. **Flight distance** is the horizontal displacement during the flight phase. Together they decompose step length into its two components, which reveals the athlete's force application strategy.

SprintLab already has the CoM trajectory and ground contact windows. Contact length is simply CoM_x(toe-off) − CoM_x(touchdown) for each contact, scaled to metres. Flight distance is CoM_x(next_touchdown) − CoM_x(toe-off).

**Why this matters:** A long contact length relative to flight distance indicates the athlete is spending a large proportion of each step on the ground — either applying force over a long duration (good if velocity is maintained) or braking excessively (bad). The ratio shifts predictably across the acceleration-to-max-velocity transition and is a standard coaching diagnostic.

### 11. Missing Spatiotemporal Metrics

Several standard sprint analysis metrics are computable from data SprintLab already has but does not currently report:

**Stride length** — the distance covered in two consecutive steps (left-right or right-left). Currently only step length (single contact-to-contact) is computed. Stride length and its relationship to stride frequency is a fundamental performance descriptor.

**Duty factor** — ground contact time divided by total stride time (GCT / (GCT + flight time)). This is the proportion of each cycle spent on the ground. It decreases as velocity increases and is a direct indicator of the athlete's force-time profile: lower duty factor means shorter, more intense ground contacts.

**Hip separation angle (scissor angle)** — the angle between the left and right thigh segments at touchdown and toe-off. This is one of the most important coaching metrics in sprinting. At touchdown, a large scissor angle indicates good front-side/back-side separation — the recovery leg is already well forward while the stance leg is behind the body. SprintLab tracks both thigh angles per frame; the scissor angle is their sum at any given instant.

**Front-side / back-side mechanics ratio** — the proportion of the thigh's range of motion that occurs in front of the vertical axis versus behind it. Calculated from the thigh segment angle time series (positive = in front, negative = behind). Elite sprinters at maximum velocity exhibit predominantly front-side mechanics. This ratio quantifies that pattern directly.

**Thigh angular velocity at touchdown** — how fast the stance-side thigh is rotating backward (toward extension) at the moment of ground contact. This is a proxy for the aggressiveness of the "pawback" or "clawing" action and correlates with horizontal ground reaction force production. SprintLab already computes thigh angular velocity; this just extracts the value at the touchdown event.

**Arm action range of motion** — shoulder flexion/extension range and elbow angle range across the stride cycle. Currently computable from existing joint angle series but not reported as a summary metric. Arm action asymmetry is a common coaching concern and is trivially detected from the bilateral data SprintLab already has.

### 12. Proxy Metrics Derivable from Current Data

These are quantities SprintLab cannot measure directly (they normally require force plates or other instrumentation) but can approximate from the kinematic data it already has. All proxy metrics should be clearly labeled as estimates in the UI.

SprintLab's primary use cases are (1) block start and acceleration analysis and (2) flying sprint / max velocity analysis, with a camera field of view covering 10–30m. The proxy metrics below are framed for these contexts.

**Requires user input:** Body mass (kg). Entered once, stored in session. Required for any force or stiffness metric.

#### Vertical Stiffness

Applicable to both use cases but most meaningful during max velocity, where the spring-mass model assumption holds (cyclical, roughly symmetric contacts). During early acceleration the body is not behaving like a bouncing spring, so stiffness values for the first 3–5 contacts should be suppressed or flagged.

The simple form is k_vert ≈ (m × π²) / (GCT²), but SprintLab can do better because it has the CoM trajectory. The more accurate computation uses the actual vertical CoM displacement during contact:

1. For each ground contact window, find Δy_CoM = CoM_y(touchdown) − min(CoM_y) during the contact. This is the vertical drop from touchdown to the lowest point (mid-stance).
2. Estimate peak vertical force: F_peak ≈ (m × g × π) / (2 × GCT). This assumes a half-sine force profile during contact, which is the standard spring-mass approximation.
3. Vertical stiffness: k_vert = F_peak / Δy_CoM.
4. Normalize: k_vert_norm = k_vert / (m × g). This dimensionless form is comparable across athletes regardless of body mass.

Display per-contact, plotted against step number. During a flying sprint, expect relatively stable values. During acceleration, expect a rising curve that plateaus as contact times shorten.

#### Braking / Propulsion Balance

Applicable to both use cases but the interpretation differs. During acceleration, contacts should be almost entirely propulsive (net braking ≈ 0). During max velocity, braking and propulsion should be roughly equal (net horizontal impulse ≈ 0).

Computation:

1. For each ground contact window, partition at the temporal midpoint.
2. Extract CoM horizontal velocity at three points: v_td (touchdown), v_mid (midpoint), v_to (toe-off).
3. Braking phase velocity change: Δv_brake = v_mid − v_td. Should be negative or near-zero.
4. Propulsive phase velocity change: Δv_prop = v_to − v_mid. Should be positive.
5. Report the ratio: |Δv_brake| / Δv_prop. Values near 0 = pure propulsion (early acceleration). Values near 1.0 = equilibrium (max velocity). Values above 1.0 = net deceleration (a problem).

**Data quality caveat:** Per-contact velocity changes are small (often <0.5 m/s per contact at higher speeds). The CoM velocity is a derivative of a smoothed position estimate, so noise can be comparable to signal. The Kalman filter (limitation #1) is a prerequisite at the keypoint level. For CoM horizontal velocity specifically, the smoothing spline with displacement constraint correction (described in limitation #3 and the Sprint Timing & Velocity Engineering Specification) is what makes per-contact velocity estimates reliable — the displacement constraint forces the velocity curve to be physically consistent with the known distance covered, which substantially reduces the error floor on small per-contact Δv values. Consider only displaying when the per-contact Δv exceeds a minimum threshold (e.g. >0.1 m/s) to avoid showing noise.

#### Reactive Strength Index (Sprint)

RSI_sprint = flight_time / GCT. Both values come directly from the contact detection system.

During acceleration, early contacts may have zero or near-zero flight time — the athlete is still in the drive phase and may not achieve a true flight phase for the first several steps. Suppress RSI_sprint for any contact where flight time is below a minimum threshold (e.g. <20ms or indistinguishable from detection noise). It becomes meaningful once the athlete transitions to cyclical sprinting, typically from around 10m onward.

During flying sprints, RSI_sprint should be relatively stable across contacts. Higher values indicate shorter, more elastic contacts with proportionally longer flight. Display per-contact and report the mean ± SD across the clip.

#### Horizontal Force-Velocity Profile (Acceleration Only)

This is the Samozino & Morin framework applied per-step. It is only meaningful for acceleration clips — during a flying sprint the athlete is at roughly constant velocity and the F-V relationship cannot be resolved.

Computation:

1. For each step cycle, compute average velocity: v_avg = step_length / step_time.
2. Compute average horizontal acceleration: a_avg = (v_end − v_start) / step_time, where v_start and v_end are CoM velocities at the start and end of the step.
3. Average horizontal force: F_h = m × a_avg + F_aero, where F_aero = 0.5 × ρ × Cd × A × v_avg² (air resistance). For simplicity, F_aero can use standard values: ρ = 1.225 kg/m³, Cd × A ≈ 0.6 m² for a sprinter. Or omit the aerodynamic term at low velocities where it's negligible.
4. Plot F_h against v_avg for all step cycles. Fit a linear regression: F_h = F0 − (F0/V0) × v.
5. Extract: F0 (y-intercept, theoretical max force at zero velocity), V0 (x-intercept, theoretical max velocity at zero force), P_max = (F0 × V0) / 4, and the F-V slope ratio (RF_max, the proportion of total force directed horizontally).

A 20–30m acceleration clip gives roughly 10–15 steps, which is sufficient for a reasonable linear fit. The main accuracy concern is the velocity estimate for the first 2–3 steps out of blocks, where distances are short and CoM displacement per step is small relative to position noise. Weight or exclude these points if residuals are high.

This is one of the most widely used sprint performance models in applied sport science. The standard implementation uses timing gate splits, but per-step CoM velocity from video is a viable input. Label it clearly as video-derived and not equivalent to timing-gate or force-plate profiling.

#### Per-Step Acceleration

The simplest and most directly useful metric for acceleration clips. For each step cycle, compute Δv / Δt where Δv is the change in average CoM horizontal velocity between consecutive steps and Δt is the step duration. Plot against step number or distance.

During a block start, this curve should start high and decrease monotonically toward zero as the athlete approaches max velocity. The shape of the decay — steep and early versus gradual and sustained — is diagnostic of the athlete's acceleration profile. Inflection points or plateaus in the curve suggest technique or strength issues at specific phases.

For flying sprints, per-step acceleration should be approximately zero (constant velocity). Any consistent negative trend is velocity decay — meaningful even over 5–8 strides.

#### Bilateral Asymmetry Indices

For any metric computed per-side — GCT, flight time, step length, contact length, thigh angle at touchdown, scissor angle, knee angle at toe-off, arm ROM — compute: ASI = |L − R| / (0.5 × (L + R)) × 100%.

Report per-metric, per-stride-pair. Flag values above 10–15% depending on the metric. Over a 10–30m clip you'll have roughly 5–15 contacts per side, which is enough for a mean ASI with reasonable confidence. Also show per-stride-pair values so the athlete can see if asymmetry is consistent or variable — consistent asymmetry suggests a structural or habitual pattern; variable asymmetry suggests fatigue or instability.

Applicable to both use cases equally.

---

## Fundamental Limitations

### 13. Monocular 2D Projection (Partially Mitigated by Phase 1)

Every spatial measurement in the current system is a projection of 3D motion onto the 2D camera plane. Out-of-plane motion is either invisible or appears as a distorted version of itself.

For sprinting, this has specific consequences. Pelvic rotation — a key indicator of hip extension quality and asymmetry — produces almost no signal in the sagittal projection. Arm swing depth is invisible. Foot placement width (step width), which matters for lateral force application and injury risk, cannot be measured. Any time the camera is not perfectly perpendicular to the direction of travel, all sagittal-plane measurements (joint angles, segment inclinations, step length) are foreshortened by the cosine of the offset angle. A 15° camera misalignment produces a ~3.4% error in distances and subtly distorts angles.

**Phase 1 mitigation:** Adopting the 3D keypoints from Wholebody3d does not eliminate this limitation but meaningfully reduces it. The model's depth estimates provide approximate out-of-plane information — enough for pelvic rotation trends, arm swing asymmetry detection, and step width estimation. However, monocular 3D depth accuracy is fundamentally lower than lateral accuracy, so these quantities should be treated as approximate and clearly communicated as such to the user.

**Full resolution** would require additional scene depth information: a second camera angle (stereo reconstruction), a depth sensor (LiDAR, structured light), or a future generation of monocular depth models with significantly better z-axis accuracy. Each introduces its own complexity and error budget.

### 14. No Temporal Model in Pose Estimation

Each frame is processed independently by RTMLib. There is no motion prior, no optical flow coupling, and no temporal consistency enforcement at the keypoint detection stage. The system relies entirely on post-hoc smoothing in the math layer to produce coherent trajectories.

This means the raw keypoint data is noisier than it needs to be — especially for fast-moving extremities where single-frame detection is most uncertain. A proper temporal model (recurrent pose estimation, or at minimum a pose-tracking-by-detection pipeline that enforces temporal coherence) would improve raw keypoint quality before any math is applied. However, this requires either a different pose estimation model or a significant post-processing pipeline between inference and the metrics engine. It's architecturally invasive and depends on the availability of suitable temporal pose models that run at acceptable speed on CPU via ONNX. The Kalman filter fix described above is the pragmatic approximation of this — it adds a temporal model after detection rather than during it.

### 15. Single Fixed Camera, No Panning Support

SprintLab assumes a static camera with the athlete moving through the field of view. A panning camera would require frame-by-frame homography estimation (using background feature tracking to separate camera motion from athlete motion) and continuous recalibration of the spatial scale as the camera-to-athlete geometry changes.

This is solvable in principle — background feature detection, RANSAC homography, and per-frame scale adjustment are well-understood techniques — but it's a substantial engineering effort that introduces a new class of error (misestimated camera motion propagates into every spatial metric). For the current use case of filming a sprint from a fixed tripod position, this limitation is acceptable. It becomes a real constraint for longer events or for footage where the camera operator tracks the athlete.

### 16. No Lens Distortion Correction

Wide-angle and smartphone lenses introduce barrel distortion that curves straight lines, especially near frame edges. SprintLab applies no distortion correction, so keypoints detected near the frame periphery have slightly wrong positions. The error is typically small for modern smartphone lenses at reasonable filming distances, but it's non-zero and it's systematic — it biases distance measurements in a consistent direction depending on where in the frame the athlete is.

Correction is possible (camera intrinsic calibration via checkerboard patterns, or lookup by device model) but adds significant UX friction for a relatively small accuracy gain in typical use cases. It becomes more important if the system is ever used with action cameras or wide-angle lenses.

---

## Future Directions

### Multi-Camera Stitching for Full 100m Analysis

SprintLab currently analyzes a single camera's field of view (10–30m). A natural extension is multi-camera coverage: five static cameras each covering 20m with 2–3m overlap, independently calibrated, producing a stitched kinematic profile across an entire 100m sprint.

This would yield a full-race velocity curve, per-step force-velocity profiling across the complete acceleration phase, and contact time progression from block start to finish — data that currently requires timing gate arrays or instrumented treadmills.

Key engineering requirements: temporal synchronization across cameras (shared audio event or cross-correlation of pose data in overlap zones), spatial registration to a common world coordinate system (known markers at camera boundaries), consistent frame rate enforcement, and a merge layer that blends or selects data in transition zones.

**Prerequisite:** The single-camera analysis must be validated and the improvements in this document (particularly Phase 1, Kalman filtering, and contact detection) should be complete first. Multi-camera stitching amplifies every per-camera error. Design the metrics engine output format to be camera-agnostic (world-space positions, not pixel coordinates) so the merge layer is straightforward to build when the time comes.

---

## Strategic Note: Market Focus

There is interest from people in other sports — soccer, NFL, NBA, BMX — and those markets have significantly more money than sprint biomechanics. The temptation is to pivot toward team sports analytics or multi-sport digital twins.

**Do not chase those markets right now.** They are already served by well-funded incumbents (Catapult, STATSports, Second Spectrum, Hawkeye) with hardware deployments, league partnerships, and proprietary datasets. The unit of value in team sports is game intelligence (spatial positioning, tactical patterns, workload management), not individual biomechanics. Building for that market means building an entirely different product for a different buyer with procurement processes and existing vendor relationships.

SprintLab's edge is specificity: a serious open-source sprint biomechanics tool for athletes without access to labs. Nobody else is building this. The people reaching out — MyoLab, TU Dortmund, researchers, athletes — are finding SprintLab because of that specificity, not despite it.

**The plan:** Mature the sprint tool. Validate against lab data. Ship the improvements in this document. Build credibility through depth. If team sports opportunities emerge from that credibility — a club or league approaches with a specific need — that's a conversation worth having. But cold-entering a saturated market while the core product is still mid-build is how both efforts end up half-finished.

Build the thing only you can build. The money follows credibility, and credibility comes from depth, not breadth.

---

## Long-Term Vision: The Fully Instrumented Track

The logical endpoint of SprintLab's trajectory is a permanently instrumented track facility where every training session automatically produces research-grade biomechanical data for every athlete, with no markers, no manual setup, and no post-processing. A facility where stepping onto the track means being tracked, identified, and analyzed in full 3D.

### What the system looks like

**Indoor track (200m):**

- 40–60 high-resolution machine vision cameras (4K minimum) mounted at two heights: elevated for top-down global tracking and athlete identification, and trackside at hip height for sagittal-plane biomechanics. Spaced at 5–10m intervals for continuous overlapping coverage. All cameras hardware-synced to a common timecode (genlock or PTP — software sync isn't precise enough for biomechanics).
- Force plates embedded flush in the track surface at strategic positions: start area, bend entries/exits, and a straight section for max velocity assessment. Full-track force plate coverage is prohibitively expensive and structurally complex, but 6–10 strategically placed plates (Kistler or AMTI, instrumented runway style) capture kinetics at the positions that matter most.
- Environmental sensors (temperature, humidity, air pressure) for normalizing performance data across sessions.
- Athlete identification via RFID or UWB tags (wristband or shoe clip) for coarse identity, refined by vision-based appearance models that propagate identity across all cameras through the spatial model.

**The software stack is the real product:**

1. Calibrate all cameras into a unified world coordinate system using known points on the track (lane markings are ideal).
2. Run pose estimation on every camera feed.
3. Fuse multi-view pose estimates into a single 3D skeletal reconstruction per athlete per frame — true 3D biomechanics from multi-view triangulation, not monocular approximation. This eliminates the depth ambiguity that is SprintLab's deepest current limitation.
4. Register force plate data to the corresponding video frames via timecode.
5. Build the biomechanics intelligence layer on top of the fused 3D data — every metric in this document, computed at research-grade accuracy, automatically, for every athlete on every session.

### Cost reality

Hardware alone is $500k–$1M: cameras ($3–5k each × 40–60), GPU compute cluster for real-time multi-stream inference, force plates ($20–40k each × 6–10), high-bandwidth synchronized networking, and physical installation. The software — multi-camera calibration, real-time multi-person pose estimation, multi-view 3D fusion, persistent athlete tracking, and the intelligence layer — is a team of engineers working for years.

### Who pays for it

The cost only makes sense if amortized across thousands of sessions over years, where the per-session cost drops and the longitudinal dataset becomes extraordinarily valuable. Plausible buyers: a national athletics federation (British Athletics, USATF, a Gulf state federation), a private elite training facility (IMG Academy), or a university with strong athletics and research ambitions funding through grants.

### Outdoor extension

An outdoor 100m/400m track is harder — variable lighting, weather exposure, wider area to cover — but the core architecture is the same. Weatherproofed camera housings, IR-capable cameras for low-light sessions, and a more robust calibration system that accounts for thermal expansion of the track and camera mounts. The software stack transfers directly.

### Path to getting there

This is not a "raise money and build it" project. Each step proves out the next:

1. **Now:** Single-camera SprintLab — validate against lab data, ship the improvements in this document.
2. **Next:** Multi-camera stitching (5 phones, 100m) — prove the spatial registration and temporal sync work at low cost.
3. **Then:** Fixed multi-camera installation in a single training facility — prove the continuous tracking and athlete identification work.
4. **Endgame:** Full instrumentation with force plates and real-time 3D fusion — pitch to a federation or facility with the budget and the need, backed by validated results from every prior step.

The intelligence layer — the software that turns raw sensor data into actionable biomechanical insight — is the through-line across all four steps. That's what SprintLab is building. The hardware scales up; the intelligence transfers.
