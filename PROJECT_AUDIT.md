# Nexus Grid Logic Project Audit

## Goal

This document audits the current project and lists what must be fixed to achieve:

- real-time dynamic data
- reliable frontend/backend integration
- no silent failures or fake "live" behavior
- stable operations with minimal crashes
- production-ready AI/data architecture

## Current Stack

- Frontend: React 18 + Vite + TypeScript + React Query + Supabase client
- Backend: FastAPI + WebSocket + optional YOLO/OpenCV + PPO model
- Database/Auth: Supabase Postgres + Realtime + Auth
- External APIs: TomTom Traffic API, OpenWeatherMap
- AI pieces currently present:
  - YOLOv8 for vehicle detection
  - PPO RL model for signal phase selection
  - heuristic simulation/forecast logic
  - basic RAG-style response layer

## Executive Verdict

The project is not production-ready for uninterrupted real-time operation yet.

It already has the right broad pieces, but the implementation still mixes real data, offline fallbacks, hardcoded localhost settings, placeholder identities, heuristic logic, and partially duplicated APIs. That means the UI may appear live even when the system is running on fallback or stale data, and several backend writes will fail or be inconsistent in real deployments.

## Highest Priority Problems

### 1. Runtime configuration is inconsistent

- Frontend API calls use `VITE_API_URL` in some places and hardcoded `http://localhost:8000` in others.
- WebSocket URLs are hardcoded to `ws://localhost:8000/ws/telemetry`.
- Supabase frontend uses `VITE_SUPABASE_PUBLISHABLE_KEY`, while backend auth and other backend modules use `VITE_SUPABASE_ANON_KEY`.

Impact:

- deployment breaks outside localhost
- WebSocket can fail in production behind HTTPS
- auth/env mismatch causes login or backend verification issues

Verified in:

- [src/lib/fetchApi.ts](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/lib/fetchApi.ts#L1)
- [src/lib/api.ts](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/lib/api.ts#L3)
- [src/hooks/useLiveTelemetry.ts](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/hooks/useLiveTelemetry.ts#L62)
- [src/pages/LiveMap.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/LiveMap.tsx#L40)
- [src/integrations/supabase/client.ts](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/integrations/supabase/client.ts#L5)
- [backend/auth.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/auth.py#L12)

Fix:

- define a single env contract:
  - `VITE_API_URL`
  - `VITE_WS_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TOMTOM_API_KEY`
  - `OPENWEATHERMAP_API_KEY`
  - `OPENAI_API_KEY`
- remove all hardcoded localhost values
- derive WS scheme from API URL or dedicated `VITE_WS_URL`

### 2. "Live" mode still falls back to simulated or calibrated data

Many backend/frontend modules fall back to synthetic Bangalore averages or static defaults when APIs are unavailable.

Impact:

- operators cannot trust the UI
- analytics may mix real and synthetic data
- reports can claim live accuracy when data is estimated

Verified in:

- [backend/traffic_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/traffic_api.py#L27)
- [backend/bangalore_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/bangalore_api.py#L120)
- [src/pages/Analytics.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Analytics.tsx#L55)
- [src/pages/BangaloreTraffic.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/BangaloreTraffic.tsx#L49)
- [src/pages/Agents.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Agents.tsx#L253)

Fix:

- split all data sources into explicit states:
  - `live`
  - `stale`
  - `degraded`
  - `offline`
- never present calibrated values as real-time values
- attach source metadata and freshness timestamp to every payload
- disable or clearly badge features when they are not using real inputs

### 3. Backend writes use a fake UUID that will break against RLS

The backend writes `performance_metrics` and `traffic_data` using `00000000-0000-0000-0000-000000000000`.

Impact:

- inserts can fail due to foreign key and RLS rules
- analytics and reports become unreliable
- backend silently prints warnings instead of recovering

Verified in:

- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L234)
- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L249)
- [supabase/migrations/20260228070600_955a11f7-9206-4138-8bb4-cb82177be8b4.sql](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/supabase/migrations/20260228070600_955a11f7-9206-4138-8bb4-cb82177be8b4.sql#L3)

Fix:

- choose one data ownership model:
  - system-wide telemetry tables without `user_id`, or
  - multi-tenant tables with authenticated service-side user mapping
- for system telemetry, create dedicated tables like:
  - `system_metrics`
  - `intersection_snapshots`
  - `incident_events`
  - `signal_commands`
- keep user-specific tables only for profiles, preferences, saved reports, operator actions

### 4. API contracts are duplicated and inconsistent

There are multiple chat/control patterns:

- `/api/rag/chat`
- `/api/chat`
- `/api/command/chat`

Some routes require auth, some do not, and the request shapes differ.

Impact:

- frontend pages depend on different contracts
- future maintenance becomes fragile
- auth/security posture is inconsistent

Verified in:

- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L35)
- [backend/simulation_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/simulation_api.py#L355)
- [backend/command_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/command_api.py#L233)
- [src/pages/Dashboard.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Dashboard.tsx#L504)
- [src/pages/Agents.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Agents.tsx#L240)

Fix:

- define one API per capability:
  - `POST /api/assistant/chat`
  - `GET /api/telemetry/snapshot`
  - `WS /ws/telemetry`
  - `POST /api/control/command`
  - `POST /api/predictions/traffic`
  - `POST /api/emergency/corridor`
- version request and response schemas with Pydantic models
- generate frontend types from backend schema if possible

### 5. Background processing is not production-safe

The backend starts long-running tasks on startup:

- YOLO tracking thread
- TomTom polling loop
- live alert ingestion loop

These are not supervised and do not expose health/failure state.

Impact:

- background loop failures can leave the app partly alive but operationally broken
- health endpoint can report success even if real ingestion is dead

Verified in:

- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L107)
- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L109)
- [backend/health_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/health_api.py#L34)

Fix:

- introduce task supervision and state tracking
- expose per-subsystem health:
  - vision status
  - traffic API last success time
  - weather API last success time
  - Supabase write success time
  - model loaded state
  - websocket client count
- add circuit breakers, retry backoff, and alerting

### 6. Health endpoint overstates system status

`/api/health` returns `vision_active: true` and `websocket_running: true` regardless of actual subsystem state.

Impact:

- monitoring cannot be trusted
- frontend can show "online" while key systems are dead

Verified in:

- [backend/health_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/health_api.py#L34)

Fix:

- connect health response to actual runtime flags and timestamps
- add readiness vs liveness endpoints:
  - `/api/health/live`
  - `/api/health/ready`
  - `/api/health/dependencies`

### 7. PPO model loading is inefficient

`predict_action` loads the PPO model from disk on every call.

Impact:

- unnecessary latency
- heavy CPU/disk overhead under sustained WebSocket load

Verified in:

- [backend/rl_model.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/rl_model.py#L86)

Fix:

- load the PPO model once at startup
- cache model instance in memory
- expose fallback mode if the model fails to load

### 8. Vision pipeline is optional but not modeled as optional in product behavior

If YOLO/OpenCV are missing or the stream cannot open, backend continues, but the system still behaves like a full vision stack exists.

Impact:

- false operator confidence
- zero counts can look like empty roads instead of dead vision

Verified in:

- [backend/vision.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/vision.py#L8)
- [backend/main.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/main.py#L122)

Fix:

- surface `vision_state` explicitly:
  - `active`
  - `degraded`
  - `disconnected`
  - `not_installed`
- stop writing zero-like telemetry when vision is unavailable
- fall back to non-vision traffic only with clear source labeling

### 9. Reports claim stronger guarantees than the data actually supports

PDF/report generation uses defaults when DB is unavailable and presents polished output.

Impact:

- misleading reporting
- weak auditability

Verified in:

- [backend/reports_api.py](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/backend/reports_api.py#L59)

Fix:

- reports must include:
  - source provenance
  - coverage window
  - freshness
  - percentage of estimated vs real records
- fail report generation for "official" mode if minimum live data coverage is not met

### 10. Supabase migration design needs cleanup

There are multiple signup triggers created across migrations, which risks duplicate trigger behavior depending on migration state.

Impact:

- brittle database setup
- possible duplicate inserts or migration conflicts

Verified in:

- [supabase/migrations/20260228070002_bdf551b7-b7ae-47ef-ac81-615565b677d5.sql](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/supabase/migrations/20260228070002_bdf551b7-b7ae-47ef-ac81-615565b677d5.sql#L47)
- [supabase/migrations/20260228114046_eb1376d6-2454-47ab-b01c-ead814683e24.sql](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/supabase/migrations/20260228114046_eb1376d6-2454-47ab-b01c-ead814683e24.sql#L45)

Fix:

- consolidate signup/profile/role trigger logic
- ensure migrations are idempotent
- add a clean schema bootstrap path

## Functional Audit By Area

## Frontend

### What must be fixed

- centralize API and WebSocket config
- add request timeout, cancellation, and stale-state handling
- replace silent fallbacks with source-aware UX
- standardize page data fetching through one client layer
- add page-level loading/error/degraded states
- remove duplicated live WebSocket connections where possible
- validate all backend responses with Zod before rendering

### Immediate code hotspots

- [src/hooks/useLiveTelemetry.ts](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/hooks/useLiveTelemetry.ts)
- [src/pages/Dashboard.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Dashboard.tsx)
- [src/pages/Analytics.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Analytics.tsx)
- [src/pages/LiveMap.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/LiveMap.tsx)
- [src/pages/Agents.tsx](/c:/Users/Dhrumil/OneDrive/Documents/nexus-grid-logic-main/src/pages/Agents.tsx)

### Recommended frontend architecture

- one shared telemetry store fed by one WebSocket connection
- React Query for REST snapshots and commands
- typed API client
- source/freshness badges on every card
- automatic reconnect with exponential backoff and jitter
- dead-man timers for stale telemetry

## Backend

### What must be fixed

- separate simulation/demo endpoints from production/live endpoints
- make WebSocket producer robust and observable
- move blocking work away from request loops
- cache models and clients at startup
- define domain services:
  - telemetry ingestion
  - prediction
  - control
  - reports
  - assistant
- return structured errors

### Recommended backend architecture

- `services/telemetry_service.py`
- `services/vision_service.py`
- `services/prediction_service.py`
- `services/control_service.py`
- `services/assistant_service.py`
- `services/health_service.py`
- `repositories/` for Supabase/Postgres access

### Reliability requirements

- bounded queues between ingestion and broadcast
- runtime metrics for loop lag and send lag
- retry wrappers around external API calls
- task cancellation on shutdown
- startup readiness checks before accepting traffic

## Database and Real-Time Data

### What must be fixed

- split system telemetry from user-owned data
- design tables around time-series and commands
- ensure indexes on timestamp and intersection keys
- avoid writing every 100ms directly from websocket logic

### Minimum schema you need

- `intersections`
- `telemetry_snapshots`
- `traffic_incidents`
- `signal_events`
- `operator_commands`
- `system_health_events`
- `prediction_results`
- `camera_streams`
- `model_registry`

### Suggested telemetry strategy

- ingest raw events into a queue or broker
- batch writes every 1s to 5s
- keep latest snapshot in Redis or in-memory state
- store historical data in Postgres/Timescale

## Real-Time Infrastructure Needed

To make everything work seamlessly without interruptions, you need more than frontend polling and one FastAPI process.

### Minimum production infrastructure

- FastAPI app behind a process manager
- Redis for pub/sub, cache, and transient telemetry state
- Postgres/TimescaleDB or Supabase Postgres for historical data
- object storage for frames/reports/model artifacts
- reverse proxy with WebSocket support
- centralized logging and metrics

### Recommended production additions

- Celery/RQ/Arq or another worker system for background jobs
- Prometheus + Grafana
- Sentry
- Redis streams or Kafka if scale increases
- containerized deployment

## Models You Actually Need

The project currently has partial versions of these, but to achieve reliable real-time behavior you should treat the stack in layers.

### A. Required for MVP

1. Detection model
- Purpose: vehicle detection and lane occupancy from camera feed
- Use: YOLOv8n or YOLOv8s fine-tuned on your actual camera angles and local vehicle mix
- Status now: partially present, not production-hardened

2. Signal decision model
- Purpose: choose signal phase or duration from queue state
- Use: PPO only if trained on realistic environment and constrained by traffic rules
- Better near-term approach: rule-based adaptive controller with safety bounds, then RL as an optimizer
- Status now: PPO exists, but environment is oversimplified

3. Short-horizon forecasting model
- Purpose: 5 to 30 minute congestion prediction
- Use: start with gradient boosting or temporal models using historical telemetry, weather, event, time-of-day
- Status now: heuristic forecast, not a trained production forecasting model

4. Incident/anomaly detection model
- Purpose: detect sudden spikes, stalled flow, camera outage, abnormal queue growth
- Use: rules first, then anomaly detection over time-series
- Status now: basic heuristics only

### B. Needed for a serious production system

1. Multi-camera tracking / re-identification
- if you want corridor-level movement and travel time estimates

2. ETA / route optimization model
- if emergency corridors should be truly optimal rather than hardcoded

3. Assistant/RAG model
- for operator chat, SOP retrieval, incident explanation, and report summarization
- should not be part of the critical control path

4. Model monitoring
- drift detection
- confidence tracking
- version registry

## Recommended Model Stack

### Practical stack for this project

- Vision:
  - YOLOv8s fine-tuned on your intersection/camera data
  - optional ByteTrack/DeepSORT for tracking
- Signal control:
  - rule-based adaptive controller first
  - PPO only after offline evaluation and safety constraints
- Forecasting:
  - XGBoost/LightGBM for tabular time-window forecasting
  - later upgrade to Temporal Fusion Transformer or TCN/LSTM if you have enough data
- Incident detection:
  - threshold + rolling z-score baseline first
  - later Isolation Forest or sequence anomaly model
- Assistant:
  - OpenAI model for ops assistant plus Supabase pgvector/RAG

## What To Build First

### Phase 1: Make the current system honest and stable

- unify config/env names
- remove hardcoded localhost
- remove fake UUID writes
- separate live vs fallback status
- make health checks real
- cache models/clients at startup
- standardize API contracts

### Phase 2: Make data flow reliable

- one telemetry ingestion path
- one WebSocket broadcaster
- Redis-backed latest snapshot cache
- proper system telemetry tables
- background worker for DB persistence and reports

### Phase 3: Upgrade model quality

- fine-tune YOLO on real cameras
- replace heuristic forecasting with trained model
- keep rule-based safety layer in front of RL
- add anomaly detection and camera health detection

### Phase 4: Production hardening

- observability
- alerts
- chaos testing for disconnects
- load tests for WebSocket and DB
- deployment with supervised workers

## Non-Negotiable Engineering Requirements

If you want "no crashes, seamless, real time", the system must have:

- no silent catch-and-ignore behavior on critical paths
- explicit degraded mode
- idempotent commands
- timeouts on every external call
- health/readiness endpoints
- tracing/logging/metrics
- test coverage for API contracts and reconnect logic
- backpressure handling for real-time streams

## Testing Gaps

Current automated validation is weak.

Observed during audit:

- `npm run test` failed in this sandbox with `spawn EPERM`
- `npm run build` failed in this sandbox with `spawn EPERM`
- repository only shows a trivial example test

Needed:

- frontend tests for telemetry hooks and degraded states
- backend tests for all API contracts
- WebSocket reconnect/load tests
- integration tests against Supabase schema
- model-loading tests

## Final Recommendation

Do not try to make this "fully dynamic and seamless" by only tweaking the UI.

The correct order is:

1. stabilize the architecture and data contracts
2. clean up database ownership and telemetry persistence
3. make degraded/live states explicit
4. harden background jobs and health checks
5. upgrade models only after the runtime path is trustworthy

If you want, the next step should be to convert this audit into a concrete implementation plan and start fixing the repo in priority order.
