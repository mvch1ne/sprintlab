# Testing

SprintLab follows a test-driven development approach. Both suites run without a GPU, a camera, or any ML model files.

## Philosophy

The test strategy is built around one key architectural decision: **pure math lives in a separate file**. By extracting all biomechanics computation into `sprintMath.ts` — a file with no React, no DOM, and no external dependencies — the most critical logic in the codebase becomes trivially testable with fast unit tests.

The backend test strategy follows the same principle: by stubbing out `cv2` and `rtmlib` at import time, the FastAPI application can be tested against a real ASGI server without any model downloads or hardware.

---

## Frontend — Vitest

**Stack:** Vitest 3 · jsdom · @testing-library/react

### Running tests

```bash
cd frontend

npm test            # one-shot run (for CI)
npm run test:watch  # watch mode during development
npm run test:ui     # interactive browser UI
```

### Configuration

**`vitest.config.ts`**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

**`src/test/setup.ts`**
```typescript
import '@testing-library/jest-dom';
```

### Test files

#### `__tests__/sprintMath.test.ts`

Unit tests for every function in `sprintMath.ts`. All tests use unit calibration (`ar = fw = fh = 1`) to keep the expected values simple.

| Describe block | Tests |
|---|---|
| `angleDeg` | 90° right angle · 180° straight line · 0° coincident arms · symmetry (A-B-C = C-B-A) |
| `segAngleDeg` | 0° for vertical segment · +90° pointing right · −90° pointing left |
| `segInclineDeg` | 90° for vertical · 0° for horizontal · 45° for diagonal · always non-negative |
| `smooth` | Same-length output · window=1 is identity · noise reduction |
| `derivative` | Same-length output · linear signal rate matches fps |
| `buildSeries` | Null filling · 0-indexed frames · all-null safety |

#### `__tests__/sprintMetrics.contacts.test.ts`

Integration tests for `detectContacts`. Tests build synthetic foot-$y$ series with known on-ground windows and assert the detected events.

| Test | What is verified |
|---|---|
| Single contact detection | Correct `contactFrame`, `liftFrame`, `contactTime` |
| Duration floor (< 50 ms) | Short contacts are rejected |
| Duration ceiling (> 600 ms) | Long contacts are rejected |
| Empty input | Returns empty array without throwing |
| All-null input | Returns empty array without throwing |
| Stable ID | `id` equals `"foot-contactFrame"` |
| Calibrated CoM distance | `scaleOps.hSigned` is applied correctly |

### Current result

```
 ✓ src/components/dashboard/__tests__/sprintMath.test.ts         (19 tests)
 ✓ src/components/dashboard/__tests__/sprintMetrics.contacts.test.ts  (7 tests)

 Test Files  2 passed (2)
       Tests  26 passed (26)
```

---

## Backend — pytest

**Stack:** pytest · pytest-asyncio · httpx (ASGI transport)

### Running tests

```bash
cd backend

# Install test dependencies (first time)
pip install pytest pytest-asyncio httpx
# or: pip install -r requirements.txt

python -m pytest
```

### Configuration

**`pytest.ini`**
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

`asyncio_mode = auto` means all `async def` test functions are automatically treated as async tests without needing an `@pytest.mark.asyncio` decorator.

### Stubs — `tests/conftest.py`

`conftest.py` runs before any test module is imported. It registers stub modules for `cv2` and `rtmlib` in `sys.modules`, so when `server.py` does `import cv2` and `from rtmlib import PoseTracker`, it gets the stubs instead.

**`_FakeCap`** — a minimal `cv2.VideoCapture` stub that yields 3 frames of 4×4 black pixels and returns fixed metadata (30 fps, 64×64).

**`_FakePoseTracker`** — returns zero-filled keypoint arrays of the correct shape `(1, 133, 2)` and `(1, 133, 3)`. This means every frame appears as "detected but all keypoints at origin with zero confidence", which is handled gracefully by the frontend's confidence threshold.

### Test file — `tests/test_server.py`

| Test | What is verified |
|---|---|
| `test_health` | `GET /health` returns `200` and `{"status": "ok"}` |
| `test_infer_video_streams_progress_then_result` | At least one `progress` event · exactly one `result` event · result has `fps`, `frames`, `n_kpts` fields |
| `test_infer_video_result_frame_shape` | Each frame array has length `n_kpts × 6` |
| `test_infer_video_progress_fields` | First `progress` event contains all required fields: `frame`, `total`, `pct`, `fps`, `elapsed`, `eta` |

Tests use `httpx.AsyncClient` with an `ASGITransport` pointing at the FastAPI app. This runs the full ASGI stack in-process without binding to a real TCP port.

### Current result

```
============================= test session starts =============================
collected 4 items

tests/test_server.py ....                                           [100%]

============================== 4 passed in 0.79s ==============================
```

---

## What is not yet tested

| Area | Notes |
|---|---|
| React components | Telemetry, Viewport — require more complex rendering setup |
| `useSprintMetrics` hook | Can be tested with `renderHook` from @testing-library/react |
| Calibration math | `CalibrationOverlay` pixel-to-metre conversion |
| CoM series | Inline computation inside `useSprintMetrics` |
| Backend error paths | Malformed video, OpenCV failure |

These are candidates for future test coverage as the project grows.
