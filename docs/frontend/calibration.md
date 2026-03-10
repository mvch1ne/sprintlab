# Calibration

**File:** `frontend/src/components/dashboard/viewport/CalibrationAndMeasurements/CalibrationOverlay.tsx`

Calibration converts pixel distances in the video into real-world metres. Without it, SprintLab can still show joint angles (which are dimensionless) but cannot report step lengths, CoM displacement, or foot-to-CoM offsets in meaningful units.

## Workflow

Calibration is a three-step interactive process:

1. **Pick start point** — click anywhere on the video frame to set the first endpoint of the reference line
2. **Pick end point** — click a second point. H/V alignment snapping guides appear to help draw straight lines along known markings (lane lines, hurdle spacing, etc.)
3. **Enter distance** — a dialog prompts for the real-world length of the drawn line in metres

On confirmation, `pixelsPerMeter` is computed and stored in `VideoContext`.

## Coordinate Transformation

The calibration overlay renders on a canvas positioned over the video. All pointer events arrive in **canvas-space** coordinates. Because the video may be zoomed and panned, these must be transformed back to **video-space** before being stored:

```typescript
const videoX = (canvasX - panOffsetX) / zoom;
const videoY = (canvasY - panOffsetY) / zoom;
```

Points are stored in normalised video-space (divided by video width and height) so they remain valid if the display size changes.

## Scale Factor Computation

The pixel length of the reference line in normalised coordinates is:

$$L_{\text{norm}} = \sqrt{(\Delta \tilde{x})^2 + (\Delta \tilde{y})^2}$$

where $\Delta \tilde{x} = x_2 - x_1$ and $\Delta \tilde{y} = y_2 - y_1$ are the differences in normalised coordinates.

To convert to pixels in the original video frame:

$$L_{px} = \sqrt{(\Delta x \cdot f_w)^2 + (\Delta y \cdot f_h)^2}$$

The pixels-per-metre factor:

$$\text{ppm} = \frac{L_{px}}{d_{\text{real}}}$$

where $d_{\text{real}}$ is the real-world distance entered by the user.

## `CalibrationData`

```typescript
interface CalibrationData {
  pixelsPerMeter: number;
  aspectRatio: number;   // video pixel aspect ratio (used in angle corrections)
  lineAngle: number;     // angle of the calibration line (degrees, informational)
}
```

`aspectRatio` is computed from the video's natural width and height and is used throughout the metrics engine to correct for non-square pixel grids. See [Math Reference — Aspect-Ratio Correction](/math#aspect-ratio-correction).

## Alignment Snapping

When drawing the second point, if the pointer is within a threshold of horizontal or vertical alignment with the first point, a guide line is shown and the second point snaps to perfect H or V alignment. This makes it easy to calibrate from straight lane markings or horizontal reference objects.

## Measurement Overlay

A companion overlay (`MeasurementOverlay`) lets users measure arbitrary distances and angles in the frame after calibration. Measurements are:

- Displayed in metres (once calibrated)
- Stored in `VideoContext` as a list of `Measurement` objects
- Shown in a `MeasurementPanel` sidebar
- Persisted across frames (not tied to any specific frame)
