# Math Reference

All biomechanics computation in SprintLab is implemented in [`sprintMath.ts`](https://github.com/mvch1ne/sprintlab/blob/main/frontend/src/components/dashboard/sprintMath.ts) — a pure TypeScript module with no React dependencies.

## Notation

| Symbol | Meaning |
|---|---|
| $p = (p_x, p_y)$ | A 2D point in inference-frame pixel coordinates |
| $\text{ar}$ | Aspect ratio correction factor from calibration (`calibration.aspectRatio`) |
| $f_w, f_h$ | Inference frame width and height in pixels |
| $\text{ppm}$ | Pixels per metre from calibration (`calibration.pixelsPerMeter`) |
| $f_s$ | Frame rate (frames per second) |
| $N$ | Total number of frames |

## Aspect-Ratio Correction

Inference-frame pixel coordinates are not physically square — the model may run at a different resolution or aspect ratio than the original video. Before computing any angle or distance in physical space, both axes are normalised:

$$\tilde{x} = \frac{p_x \cdot \text{ar}}{f_w}, \qquad \tilde{y} = \frac{p_y}{f_h}$$

This maps every point into a normalised space where distances are proportional to real-world distances. All angle and length calculations below operate on $(\tilde{x}, \tilde{y})$.

---

## Interior Joint Angle — `angleDeg`

**Used for:** hip, knee, ankle, shoulder, elbow, wrist.

Given three points $A$, $B$, $C$, computes the interior angle at vertex $B$:

$$\theta_{ABC} = \arccos\!\left(\frac{\vec{BA} \cdot \vec{BC}}{|\vec{BA}|\,|\vec{BC}|}\right)$$

where the vectors are computed in normalised space:

$$\vec{BA} = \left(\frac{(A_x - B_x)\,\text{ar}}{f_w},\ \frac{A_y - B_y}{f_h}\right), \qquad \vec{BC} = \left(\frac{(C_x - B_x)\,\text{ar}}{f_w},\ \frac{C_y - B_y}{f_h}\right)$$

The result is clamped to $[-1, 1]$ before passing to $\arccos$ to guard against floating-point overflow:

$$\theta_{ABC} = \arccos\!\left(\max\!\left(-1,\,\min\!\left(1,\,\frac{\vec{BA} \cdot \vec{BC}}{|\vec{BA}|\,|\vec{BC}|}\right)\right)\right) \cdot \frac{180}{\pi}$$

**Range:** $[0°, 180°]$. Returns $0°$ when the two arms are coincident (i.e. $|\vec{BA}||\vec{BC}| < 10^{-6}$).

**Joint definitions:**

| Joint | $A$ | $B$ (vertex) | $C$ |
|---|---|---|---|
| Hip | Knee | Hip | Shoulder |
| Knee | Hip | Knee | Ankle |
| Ankle | Knee | Ankle | Toe |
| Shoulder | Elbow | Shoulder | Hip |
| Elbow | Shoulder | Elbow | Wrist |
| Wrist | Elbow | Wrist | *(proxy toe)* |

---

## Segment Angle from Vertical — `segAngleDeg`

**Used for:** thigh (hip → knee).

Computes the signed angle of the segment $p_1 \to p_2$ relative to the **downward vertical** (+$y$ points down in screen space):

$$\alpha = \text{atan2}\!\left(\frac{(x_2 - x_1)\,\text{ar}}{f_w},\ \frac{y_2 - y_1}{f_h}\right) \cdot \frac{180}{\pi}$$

**Convention:**
- $\alpha = 0°$ — segment points straight down (vertical)
- $\alpha > 0°$ — segment leans right of vertical
- $\alpha < 0°$ — segment leans left of vertical

**Why this convention for the thigh?** The thigh angle from downward vertical is a standard biomechanics reference. During sprinting, the thigh cycles from behind the body (negative) to in front of it (positive), making the signed value directly interpretable as drive phase vs. recovery phase.

---

## Segment Inclination from Horizontal — `segInclineDeg`

**Used for:** torso (CoM → nose) and shin (knee → ankle).

Computes the **unsigned** inclination of the segment $p_1 \to p_2$ from the **horizontal**:

$$\phi = \text{atan2}\!\left(\left|\frac{y_2 - y_1}{f_h}\right|,\ \left|\frac{(x_2 - x_1)\,\text{ar}}{f_w}\right|\right) \cdot \frac{180}{\pi}$$

The absolute values of both components mean the result is always in $[0°, 90°]$, regardless of which direction along the segment you measure.

**Convention:**
- $\phi = 0°$ — segment is horizontal
- $\phi = 90°$ — segment is perfectly vertical
- $\phi < 90°$ — segment is tilted from vertical

**Why inclination from horizontal for torso and shin?**

For these segments, "vertical" is the reference state — an upright torso and a vertical shin at ground contact. Measuring from horizontal means 90° is the reference and deviations from 90° are directly readable as degrees of lean or tilt, which is more intuitive than measuring from vertical (where the reference would be 0°).

---

## Box Smoothing — `smooth`

A symmetric box (moving average) filter of window width $w$:

$$\hat{x}_i = \frac{1}{|\mathcal{N}(i)|} \sum_{k \in \mathcal{N}(i)} x_k$$

where the neighbourhood is:

$$\mathcal{N}(i) = \left\{k \in \mathbb{Z} : |k - i| \leq \left\lfloor \frac{w}{2} \right\rfloor,\ 0 \leq k < N \right\}$$

The boundary condition is **shrinking window**: near the edges, only the in-bounds indices contribute, so $|\mathcal{N}(i)| < w$ for $i < \lfloor w/2 \rfloor$ or $i > N - 1 - \lfloor w/2 \rfloor$. This preserves array length and avoids zero-padding artefacts.

**Applied twice** (`w = 3`) before computing velocity, giving an effective triangular (Bartlett) smoothing kernel.

---

## Numerical Derivative — `derivative`

Central-difference approximation of the first derivative, then smoothed:

$$\dot{x}_i = \frac{x_{i+1} - x_{i-1}}{2} \cdot f_s, \qquad 1 \leq i \leq N-2$$

Boundary frames use one-sided replication:

$$\dot{x}_0 = \dot{x}_1, \qquad \dot{x}_{N-1} = \dot{x}_{N-2}$$

The result is smoothed with a box filter ($w = 5$) to suppress noise amplification.

**Applied twice** to obtain:
- **Velocity** $\dot{\theta}$ from angles (deg/s)
- **Acceleration** $\ddot{\theta}$ from velocity (deg/s²)

---

## Null Filling — `buildSeries`

Keypoints with score $< 0.35$ are returned as `null`. Before any smoothing, nulls are filled using **forward-fill then backward-fill**:

**Forward fill:**
$$x_i \leftarrow x_{i-1} \quad \text{if } x_i = \text{null and } x_{i-1} \neq \text{null}$$

**Backward fill (for leading nulls):**
$$x_i \leftarrow x_{i+1} \quad \text{if } x_i = \text{null and } x_{i+1} \neq \text{null}$$

If all values are null (joint never detected), the array is filled with $0$.

---

## Ground Contact Detection

Detection operates on the combined foot $y$-coordinate — the maximum (lowest point on screen) of heel $y$ and toe $y$ at each frame:

$$y_{\text{foot},i} = \max(y_{\text{heel},i},\ y_{\text{toe},i})$$

Let $y_{\max}$ and $y_{\min}$ be the maximum and minimum of all valid foot $y$ values across the clip. The **contact threshold** is:

$$y_{\text{floor}} = y_{\max} - 0.10 \cdot (y_{\max} - y_{\min})$$

A frame $i$ is classified as **on ground** if $y_{\text{foot},i} \geq y_{\text{floor}}$.

**Gap filling:** consecutive on-ground windows separated by fewer than 4 frames are merged (a brief airborne detection inside a contact is treated as noise).

A contact window $[\,t_\text{start},\, t_\text{end})$ is retained only if its duration is in the sprint-plausible range:

$$0.05\ \text{s} \leq \frac{t_\text{end} - t_\text{start}}{f_s} \leq 0.60\ \text{s}$$

---

## Distance Scaling

All pixel distances are converted to metres using the calibration scale factor. Horizontal distances are corrected for the video aspect ratio:

$$d_m = \frac{|d_{px}|}{f_w} \cdot \frac{\text{ar}}{\text{ppm}}$$

For signed horizontal offsets (e.g. foot position relative to CoM):

$$d_m = \frac{d_{px}}{f_w} \cdot \frac{\text{ar}}{\text{ppm}}$$

For 2D Euclidean distances:

$$d_m = \frac{1}{\text{ppm}} \cdot \sqrt{\left(\frac{d_{px,x}}{f_w} \cdot \text{ar}\right)^2 + \left(\frac{d_{px,y}}{f_h}\right)^2}$$

---

## Center of Mass Trajectory

The CoM is approximated as the midpoint of the left and right hip landmarks:

$$\text{CoM}_i = \left(\frac{x_{\text{lhip},i} + x_{\text{rhip},i}}{2},\ \frac{y_{\text{lhip},i} + y_{\text{rhip},i}}{2}\right)$$

The horizontal CoM position in metres at frame $i$:

$$X_i = \frac{x_{\text{CoM},i}}{f_w} \cdot \frac{\text{ar}}{\text{ppm}}$$

After smoothing ($w = 5$), the horizontal speed is the magnitude of the numerical derivative:

$$v_i = \left|\dot{X}_i\right| = \left|\frac{X_{i+1} - X_{i-1}}{2} \cdot f_s\right|$$

Acceleration:

$$a_i = \left|\dot{v}_i\right|$$

Cumulative horizontal distance travelled:

$$D_i = \sum_{k=1}^{i} \frac{v_k}{f_s}$$

This is a discrete Riemann sum approximating $\int_0^{t_i} v(t)\,\mathrm{d}t$.

---

## Velocity Calculation Modes

SprintLab uses two distinct velocity strategies depending on the selected sprint mode, each chosen to give the most physically meaningful result for that context.

### Static Start Mode — Instantaneous Velocity

In static start mode, the athlete accelerates from rest. The velocity displayed at each frame is the **instantaneous** horizontal speed of the CoM — the same per-frame derivative computed in the CoM trajectory pipeline:

$$v_i = \left|\dot{X}_i\right| = \left|\frac{X_{i+1} - X_{i-1}}{2} \cdot f_s\right|$$

This directly exploits the frame-by-frame pose data to capture the true instantaneous acceleration profile from first movement through maximum speed. Dividing total displacement by total elapsed time (an average) would obscure this profile. Frames where the CoM has not yet reached the start line are masked to zero.

> **Why not use average velocity here?** During acceleration, the athlete's speed changes continuously. An average (total distance ÷ total time) is dominated by the slow early frames and does not reflect the speed the athlete has actually reached at any given moment. Instantaneous velocity shows the true speed at each frame.

### Flying Sprint Mode — Zone Velocity + Instantaneous Sparkline

In flying sprint mode, the athlete is at near-maximum speed throughout the measurement zone. The **primary metric** is the average zone velocity — the standard approach used in fly-zone testing:

$$v_{\text{zone}} = \frac{d_{\text{zone}}}{\Delta t_{\text{zone}}} = \frac{\left|X_{\text{exit}} - X_{\text{entry}}\right|}{(f_{\text{exit}} - f_{\text{entry}}) / f_s}$$

Because the athlete has stopped accelerating appreciably, the average across the zone is a reliable proxy for peak speed and matches the measurement convention used in electronic timing gates.

**Additionally**, an **instantaneous velocity sparkline** is rendered for the frames within the fly zone, using the same per-frame derivative $v_i$. This reveals within-zone velocity variation (e.g., slight deceleration near zone exit) and provides qualitative confirmation that the athlete was truly at constant speed — validating the average-zone-velocity reading.

> **Summary:** Flying mode uses zone average as its scalar velocity metric (standard, comparable across athletes and setups) but adds instantaneous sparkline to expose any within-zone speed variation.
