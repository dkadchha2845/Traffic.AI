# `backend/simulation_api.py` Audit And Replacement

## Endpoints Originally In The File

1. `POST /api/simulate`
2. `GET /api/simulate/autofill`
3. `GET /api/junctions`

## Non-Route Helpers Originally Used Elsewhere

- `_compute_simulation(req)` imported by `backend/command_api.py`
- `_generate_chat_response(message, junction_id)` imported by `backend/chat_api.py`

## What Was Fake Before

### `POST /api/simulate`

Removed fake inputs and formulas:

- Static `JUNCTIONS[*].base_density`
- Static `HOURLY_BASELINE`
- Static `WEATHER_DENSITY_FACTOR`
- Static `EVENT_DENSITY_FACTOR`
- Density blend:
  - `adjusted_density = base_density * 0.6 + hourly_bias * 0.4`
- Weather/event scaling:
  - `adjusted_density *= weather_factor * event_factor`
- Emergency density reduction:
  - `adjusted_density = max(5.0, adjusted_density * 0.65)`
- Queue estimate:
  - `queue_per_lane = round(capacity_per_lane * (adjusted_density / 100.0) * weather_factor)`
- Threshold-based signal timings:
  - emergency -> `NS=90`, `EW=15`
  - density `>= 80` -> `NS=65`, `EW=25`
  - density `>= 60` -> `NS=50`, `EW=30`
  - density `>= 40` -> `NS=40`, `EW=35`
  - else -> `NS=30`, `EW=30`
- Clearance formula:
  - `clearance_min = round((total_queue / max(1, capacity_per_lane * lanes)) * (green_ns / 60) + 1, 1)`
- Speed estimate:
  - `avg_speed = round(max(5, 55 * (1 - adjusted_density / 100)), 1)`
- Threshold-generated congestion labels and AI recommendation text
- Peak-hour heuristic:
  - `(7 <= hour <= 10) or (17 <= hour <= 21)`

### `GET /api/simulate/autofill`

Removed fake/semi-fake logic:

- `peak_hour` derived from fixed hour windows
- frontend-facing shape implied manual simulation overrides

### `_generate_chat_response`

Removed fake/static knowledge:

- hardcoded congestion ranges like `88-92%`, `76-82%`
- hardcoded city/system claims like `12M+ population`, `12-25% improvement`
- hardcoded emergency timing claims
- hardcoded route suggestions
- hardcoded vehicle class distributions
- signal timing answers sourced from `_compute_simulation`

## What Replaced It

### `POST /api/simulate`

Now returns live junction analysis only:

- Traffic from `TomTom` via `get_live_traffic_congestion`
- Weather from `OpenWeatherMap` via `get_live_weather`
- Latest stored telemetry from:
  - `intersection_snapshots`
  - `traffic_data`
  - live in-memory `command_state` only when recent and only for the central live node
- No fallback to simulated values
- Returns `503` if all live sources are unavailable
- Returns `ignored_inputs` when old manual override fields are sent, instead of using them

### `GET /api/simulate/autofill`

Now returns live-only reference data:

- live density
- live speed
- live weather
- latest vehicle/signal snapshot if available
- source metadata
- snapshot timestamp
- no peak-hour heuristic

### `GET /api/junctions`

Still returns supported junctions, but now for live analysis only.

## Callers Updated

- `backend/chat_api.py`
  - before: imported `_generate_chat_response`
  - after: imports `build_live_chat_response`
- `backend/command_api.py`
  - before: imported `_compute_simulation`
  - after: imports `build_live_junction_analysis`
- `backend/main.py`
  - still mounts the router only

## Frontend Consumers Updated

- `src/pages/Agents.tsx`
  - switched from simulated `inputs/outputs` payload to live `traffic/weather/snapshot/summary`
  - old manual override controls are now display-only and explicitly ignored by the backend
- `src/pages/Dashboard.tsx`
  - junction panel now shows live density, speed, weather, vehicle count, signal phase, and snapshot/source metadata

## Validation

- `npx tsc --noEmit` passed
- targeted backend syntax validation with `python -m py_compile` passed
- broad `python -m compileall backend` timed out because it traversed `backend/venv`; no source-file syntax error was found in the targeted run
