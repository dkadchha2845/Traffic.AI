# Live Data Remediation Log

## Scope

Searched the repo for operational fake-data patterns across frontend and backend:

- `Math.random`
- `mock`
- `dummy`
- `seed`
- `fallback`
- `placeholder`
- hardcoded percentage/status values
- static local rows returned when backend or DB was unavailable

Decorative randomness remains only in non-data visual components such as particle/starfield effects. Operational pages, metrics, charts, tables, and live-status panels were the focus of this remediation.

## Backend changes

- `backend/traffic_api.py`
  - Removed calibrated fallback traffic and weather values.
  - Replaced with explicit unavailable payloads when TomTom/OpenWeatherMap data is missing.

- `backend/bangalore_api.py`
  - Removed fake Bangalore congestion defaults.
  - Replaced with live zone snapshots and `503` when no live zone data exists.

- `backend/live_data_api.py`
  - Added live system endpoints:
    - `/api/system/metrics/history`
    - `/api/system/intersections/history`
    - `/api/system/cameras`
    - `/api/system/notifications`
    - `/api/system/network`
    - `/api/system/weather`
  - Removed fabricated per-camera class-count ratios.
  - Replaced camera responses with live zone counts, congestion, speed, source, and vision state.

- `backend/prediction_api.py`
  - Removed baseline/noise-style hotspot projection.
  - Replaced with recent live density history from `intersection_snapshots` plus current live zone data.

- `backend/main.py`
  - Added `chat_api` router so `/api/chat` actually resolves.
  - Added `/api/vision/frame` for a real current vision-frame endpoint.
  - Kept telemetry in degraded/offline states instead of faking live values.

- `backend/command_api.py`
  - Removed fake fallback log row from `/api/command/logs`.
  - Replaced hardcoded data source assumptions with runtime-derived availability.
  - Returns `null` for unavailable density instead of pretending values exist.

- `backend/audit_api.py`
  - Removed fake offline log entry.
  - Replaced with an honest empty list when audit data is unavailable.

- `backend/health_api.py`
  - Removed calibrated-fallback wording from health source reporting.
  - Replaced with `Unavailable` when live dependency data is missing.

- `backend/chat_api.py`
  - Removed assistant fallback text that implied live conditions even when dependencies failed.
  - Replaced with explicit unavailable-state wording.

- `backend/ingest_api.py`
  - Removed default `"clear"` weather placeholder from telemetry ingest payloads.
  - Replaced with `null` unless a real weather condition is supplied.

## Frontend shared data flow changes

- `src/hooks/useSystemStatus.ts`
  - Added shared live polling hooks for network status, dependency status, and weather.

- `src/hooks/useLiveTelemetry.ts`
  - Removed frontend weather fallback state (`Clear`, `28.5C`, etc.).
  - Replaced weather with backend `/api/system/weather`.

- `src/hooks/useTrafficDB.ts`
  - Removed fake log fallback rows and direct dependence on user-scoped mock-ish table reads.
  - Replaced reads with live backend system endpoints.

## Page changes

- `src/pages/CameraFeed.tsx`
  - Removed synthetic detection boxes and fake vehicle class breakdowns.
  - Removed dead RTSP “Connect” UI that did not actually connect anything.
  - Replaced with live per-location camera telemetry plus a real backend vision-frame preview when available.

- `src/pages/Analytics.tsx`
  - Removed the camera composition pie chart based on fabricated class ratios.
  - Replaced with live per-camera vehicle totals.
  - Kept charts only on live system metrics, live zone throughput, and live stored directional snapshots.

- `src/pages/LiveMap.tsx`
  - Removed static side-panel stats (`9`, `98.2%`, `12`, `18ms`).
  - Removed popup defaults like fixed signal durations and always-active status.
  - Replaced with `/api/system/network`, actual telemetry status, and unavailable states when no live value exists.

- `src/pages/Dashboard.tsx`
  - Removed static subsystem/agent list.
  - Removed fixed node counts and synthetic “AI decisions” counter.
  - Removed fake weather display defaults.
  - Replaced with live subsystem status from `/api/health/dependencies`, live network counts from `/api/system/network`, live weather from `/api/system/weather`, and real storage values from system metrics.

- `src/pages/DigitalTwin.tsx`
  - Removed `Math.random()`-driven vehicle placement, random local density, fixed latency badge, and fake signal visuals.
  - Replaced with deterministic movement driven by live total vehicle volume and live junction/zone density from `/api/system/network`.

- `src/pages/TrafficPrediction.tsx`
  - Removed default `current_congestion=60` fallback.
  - Removed “deep learning” wording that overstated the current implementation.
  - Replaced with live-telemetry-gated prediction loading and explicit unavailable states.

- `src/pages/Agents.tsx`
  - Removed auto-fill fallback that silently used local telemetry when the backend autofill API failed.
  - Removed fake default signal timing values.
  - Replaced with explicit live autofill failure handling and unavailable timing display.

- `src/pages/Notifications.tsx`
  - Replaced static seeded notification content with `/api/system/notifications`.

- `src/pages/BangaloreTraffic.tsx`
  - Removed fake fallback zone metrics.
  - Replaced with live zone data only, including unavailable/degraded handling.

- `src/pages/Reports.tsx`
  - Removed placeholder “Awaiting live system data” report row.
  - Replaced with an honest empty-table state.
  - Corrected the error-event counter to actual last-24-hour logs.

- `src/pages/Profile.tsx`
  - Removed fake operator stats (`247`, `99.9%`, `12`).
  - Replaced with real role, access level, department, and email verification state.

- `src/pages/Landing.tsx`
  - Removed hardcoded hero stats (`99.9%`, `10k+`, `0.02s`, `45%`).
  - Replaced with live uptime, active node count, latency, and telemetry state.
  - Removed unsupported numeric marketing claims in hero/features/testimonials.

- `src/pages/Help.tsx`
  - Removed unsupported fixed claims like prediction accuracy percentages and sub-millisecond guarantees.
  - Replaced with neutral, evidence-safe documentation copy.

## Validation

- `npx tsc --noEmit` passed.
- `python -m compileall backend` passed.

## Notes

- `python -m compileall backend` updated `backend/__pycache__` files during validation.
- There are pre-existing unrelated worktree changes outside this remediation set; they were left untouched.
