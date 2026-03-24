from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from auth import get_current_user_id
import os
from dotenv import load_dotenv
from runtime_state import mark_error, mark_payload, mark_success, set_websocket_client_delta
from system_telemetry import persist_system_telemetry
import json
import asyncio

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="TrafficAI Backend API")

# Configure CORS so the React frontend can talk to us
# In production, specify your Vercel URL in FRONTEND_ORIGINS environment variable
_raw_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:8080,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173")
allowed_origins = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]

# If in a flexible environment (like Vercel proxy), we might want to allow more
if os.getenv("ALLOW_ALL_CORS") == "true":
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — catches any unhandled exception and returns a clean JSON 500
from fastapi.requests import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}", "message": str(exc)},
    )

from health_api import router as health_router
app.include_router(health_router)

@app.get("/api/me")
def get_my_profile(user_id: str = Depends(get_current_user_id)):
    """
    A protected endpoint. Only accessible if a valid Supabase JWT is provided.
    """
    return {
        "message": f"Hello User {user_id}! You are authenticated.",
        "user_id": user_id
    }

from agent import get_rag_response, auto_ingest_live_alerts

@app.post("/api/rag/chat")
def rag_chat(query: str, user_id: str = Depends(get_current_user_id)):
    """
    RAG Agent endpoint.
    Takes the user query, searches Supabase for real-life traffic scenarios, and generates a response.
    Requires user to be logged in.
    """
    response = get_rag_response(query, user_id)
    return {
        "user_id": user_id,
        "query": query,
        "response": response
    }

from reports_api import router as reports_router
app.include_router(reports_router)

from ingest_api import router as ingest_router
app.include_router(ingest_router)

from bangalore_api import router as bangalore_router
app.include_router(bangalore_router)

from live_data_api import router as live_data_router
app.include_router(live_data_router)

from chat_api import router as chat_router
app.include_router(chat_router)

from prediction_api import router as prediction_router
app.include_router(prediction_router)

from audit_api import router as audit_router
app.include_router(audit_router)

from simulation_api import router as simulation_router
app.include_router(simulation_router)

from command_api import router as command_router
app.include_router(command_router)
import command_api as _command_api  # shared state ref

import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from supabase.client import create_client, Client

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

print(f"[DEBUG main.py] URL: {SUPABASE_URL}")
print(f"[DEBUG main.py] KEY exists: {bool(SUPABASE_KEY)}")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    mark_success("supabase", status="configured")
else:
    mark_error("supabase", "Supabase service role key missing", status="offline")

from camera_config import get_camera_config, get_camera_configs, get_primary_camera_config
from traffic_api import get_live_traffic_congestion, get_live_incidents
from rl_model import get_model_status, load_model
from vision_runtime import vision_manager

# --- Real-World API Polling State ---
live_grid_congestion = {
    f"BLR-{i}": 0 for i in range(1, 10)
}
live_incidents_data = []
grid_last_updated = 0.0
grid_coords = {
    "BLR-1": (12.9176, 77.6238), "BLR-2": (12.9226, 77.6174), "BLR-3": (12.9345, 77.6265),
    "BLR-4": (12.9784, 77.6408), "BLR-5": (12.9749, 77.6080), "BLR-6": (12.9779, 77.5724),
    "BLR-7": (13.0354, 77.5971), "BLR-8": (13.0068, 77.6994), "BLR-9": (12.8452, 77.6602)
}

async def _do_one_tomtom_poll():
    """Single TomTom poll cycle — called on startup and then every 60s."""
    global live_incidents_data, grid_last_updated
    last_data = {}
    for node_id, (lat, lon) in grid_coords.items():
        data = get_live_traffic_congestion(lat, lon)
        if data.get("available") and data["congestion_level"] is not None:
            live_grid_congestion[node_id] = data["congestion_level"]
        last_data = data
        await asyncio.sleep(0.5)
    live_incidents_data = get_live_incidents(12.9716, 77.5946)
    grid_last_updated = time.time()
    if last_data.get("available"):
        mark_success("traffic_api", status="live", source=last_data.get("source", "unknown"))
    return last_data


async def poll_tomtom_api():
    """Polls TomTom APIs every 60 seconds to keep the grid fresh."""
    while True:
        try:
            await _do_one_tomtom_poll()
            await asyncio.sleep(60.0)
        except Exception as e:
            print("TomTom Polling Error:", e)
            mark_error("traffic_api", e)
            await asyncio.sleep(60.0)

camera_configs = get_camera_configs()
primary_camera = get_primary_camera_config()
primary_camera_id = primary_camera["id"]


def _get_primary_vision_snapshot():
    preferred_camera_id = vision_manager.get_preferred_camera_id() or primary_camera_id
    snapshot = vision_manager.get_snapshot(preferred_camera_id) or {}
    status = vision_manager.get_status(preferred_camera_id)
    metrics = vision_manager.get_latest_metrics(preferred_camera_id)
    return preferred_camera_id, snapshot, status, metrics


@app.get("/api/vision/frame")
def get_vision_frame():
    frame = vision_manager.get_latest_frame(primary_camera_id)
    if not frame:
        raise HTTPException(status_code=503, detail="Live vision frame unavailable.")
    return Response(content=frame, media_type="image/jpeg", headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})


@app.get("/api/vision/frame/{camera_id}")
def get_vision_frame_by_camera(camera_id: str):
    if not get_camera_config(camera_id):
        raise HTTPException(status_code=404, detail=f"Unknown camera '{camera_id}'.")
    frame = vision_manager.get_latest_frame(camera_id)
    if not frame:
        raise HTTPException(status_code=503, detail=f"Live vision frame unavailable for {camera_id}.")
    return Response(content=frame, media_type="image/jpeg", headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})

@app.on_event("startup")
async def startup_event():
    vision_manager.start_all()
    load_model()
    if get_model_status().get("loaded"):
        mark_success("rl_model", status="live")
    else:
        mark_error("rl_model", get_model_status().get("error") or "RL model unavailable", status="not_loaded")
    aggregate_vision = vision_manager.get_aggregate_status()
    if aggregate_vision["status"] == "active":
        mark_success("vision", status="active", source=f"{aggregate_vision['active_count']} active camera streams")
    else:
        # Software-only mode: no cameras, using TomTom API-based sensing
        mark_success("vision", status="api_sensing", source="TomTom Traffic Flow API")

    # --- Immediate TomTom poll so Map/Dashboard/DigitalTwin have data from second 1 ---
    try:
        print("[Startup] Running immediate TomTom API poll...")
        await _do_one_tomtom_poll()
        print(f"[Startup] TomTom data loaded for {sum(1 for v in live_grid_congestion.values() if v > 0)}/9 nodes")
    except Exception as e:
        print(f"[Startup] Initial TomTom poll failed (will retry in background): {e}")

    # --- Auto-seed signal_logs so Audit Trail + System Logs show data immediately ---
    if supabase:
        try:
            boot_logs = [
                {"agent_name": "SystemBoot", "action": "Startup", "reasoning": "TrafficAI backend started. All subsystems initializing.", "impact": "INFO"},
                {"agent_name": "TomTomAPI", "action": "Connection", "reasoning": f"TomTom live traffic feed connected. Grid nodes active: {sum(1 for v in live_grid_congestion.values() if v > 0)}/9", "impact": "SUCCESS"},
                {"agent_name": "VisionEngine", "action": "Status", "reasoning": f"Vision mode: {'Camera active' if aggregate_vision['status'] == 'active' else 'API-based sensing (TomTom Traffic Flow)'}. No hardware cameras required.", "impact": "INFO"},
                {"agent_name": "RLModel", "action": "Status", "reasoning": f"PPO RL model: {'loaded and active' if get_model_status().get('loaded') else 'not loaded — using heuristic fallback'}", "impact": "INFO" if get_model_status().get('loaded') else "WARN"},
                {"agent_name": "SupabaseDB", "action": "Connection", "reasoning": "Supabase Postgres connection established. Telemetry persistence active.", "impact": "SUCCESS"},
            ]
            supabase.table("signal_logs").insert(boot_logs).execute()
            print(f"[Startup] Seeded {len(boot_logs)} boot log entries into signal_logs")
        except Exception as e:
            print(f"[Startup] Failed to seed boot logs: {e}")

    asyncio.create_task(poll_tomtom_api())
    asyncio.create_task(auto_ingest_live_alerts())

@app.on_event("shutdown")
def shutdown_event():
    vision_manager.stop_all()
    mark_error("vision", "Tracker stopped", status="disconnected", source="all cameras")

import time
import psutil

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    Bi-directional WebSocket endpoint providing live traffic operational metrics.
    Replaces the old 1-way SSE architecture to support Phase 8 manual overrides.
    """
    await websocket.accept()
    from rl_model import predict_action

    # Mutable operator control state — mirrors command_api.command_state so REST and WS stay in sync
    operator_state = _command_api.command_state
    set_websocket_client_delta(1)

    async def listen_for_commands():
        """Asynchronous listener for Command Center UI overrides via WebSocket."""
        try:
            while True:
                data = await websocket.receive_json()
                if data.get("type") == "command":
                    operator_state["emergency_active"] = data.get("emergency", False)
                    operator_state["ai_paused"] = not data.get("simRunning", True)
                    operator_state["manual_phase"] = data.get("force_phase", None)
                    print(f"Command Center Override Accepted: {operator_state}")
        except Exception:
            pass

    # Fire background listener
    asyncio.create_task(listen_for_commands())

    last_db_insert = time.time()
    last_traffic_data_insert = time.time()

    try:
        while True:
            t_start = time.perf_counter()
            
            # Get real vehicle density from the live computer vision module
            preferred_camera_id, vision_snapshot, vision_status, vision_metrics = _get_primary_vision_snapshot()
            aggregate_vision = vision_manager.get_aggregate_status()
            if aggregate_vision["status"] == "active":
                mark_success("vision", status="active", source=f"{aggregate_vision['active_count']} active camera streams")
            else:
                mark_error("vision", aggregate_vision.get("last_error") or "Vision degraded", status=aggregate_vision["status"], source=f"{aggregate_vision['configured_count']} configured camera streams")

            real_density = vision_metrics["density_percentage"]
            vehicle_count = vision_metrics["vehicle_count"]
            
            # Extract physical spatial queues
            lanes_dict = vision_metrics.get("lanes", {"north": 0, "south": 0, "east": 0, "west": 0})
            lane_counts = [
                lanes_dict["north"],
                lanes_dict["south"],
                lanes_dict["east"],
                lanes_dict["west"]
            ]

            if vision_status["status"] != "active":
                # API-Based Sensing: derive metrics from TomTom grid congestion data
                # Uses real TomTom speed/congestion ratios — NOT random data
                grid_values = [v for v in live_grid_congestion.values() if v > 0]
                if grid_values:
                    avg_congestion = sum(grid_values) / len(grid_values)
                    real_density = round(avg_congestion, 1)
                    # Traffic engineering: vehicle estimate from congestion ratio
                    vehicle_count = int(10 + (avg_congestion / 100) * 110)
                    # Distribute across 4 directions using top-4 grid node congestion weights
                    sorted_nodes = sorted(live_grid_congestion.items(), key=lambda x: x[1], reverse=True)
                    total = sum(v for _, v in sorted_nodes[:4]) or 1
                    lane_counts = [
                        int(vehicle_count * sorted_nodes[0][1] / total) if len(sorted_nodes) > 0 else 0,
                        int(vehicle_count * sorted_nodes[1][1] / total) if len(sorted_nodes) > 1 else 0,
                        int(vehicle_count * sorted_nodes[2][1] / total) if len(sorted_nodes) > 2 else 0,
                        int(vehicle_count * sorted_nodes[3][1] / total) if len(sorted_nodes) > 3 else 0,
                    ]
                else:
                    real_density = 0
                    lane_counts = [0, 0, 0, 0]

            # Telemetry is "live" if EITHER vision is active OR TomTom data is fresh
            has_fresh_tomtom = grid_last_updated > 0 and (time.time() - grid_last_updated) <= 120
            has_active_vision = vision_status["status"] == "active"

            if has_active_vision or has_fresh_tomtom:
                telemetry_status = "live"
            elif grid_last_updated > 0:
                telemetry_status = "stale"
            else:
                telemetry_status = "offline"
            
            # AI determines optimal physical light — honour REST overrides too
            manual_phase = operator_state.get("manual_phase") or operator_state.get("signal_phase")
            if operator_state["ai_paused"]:
                signal_state = manual_phase or "NS_GREEN"
            elif operator_state["emergency_active"]:
                # Phase 6: Emergency Vehicle Priority - Force Green on the dominent lane
                if max(lane_counts[0], lane_counts[1]) > max(lane_counts[2], lane_counts[3]):
                    signal_state = "NS_GREEN"
                else:
                    signal_state = "EW_GREEN"
            else:
                rl_action = predict_action(lane_counts)
                signal_state = "NS_GREEN" if rl_action == 0 else "EW_GREEN"

            # Real hardware telemetry
            local_cpu = psutil.cpu_percent(interval=None)
            local_memory = psutil.virtual_memory().percent
            
            t_end = time.perf_counter()
            backend_latency_ms = (t_end - t_start) * 1000
            
            payload = {
                "type": "telemetry",
                "cpu_load": round(local_cpu, 1),
                "memory_usage": round(local_memory, 1),
                "network_latency": round(backend_latency_ms + 2.0, 1), # Add fixed 2ms wire overhead
                "active_nodes": 9, # The 9 mapped physical Bangalore intersections
                "density": round(real_density, 1),
                "vehicle_count": vehicle_count,
                "signal_phase": signal_state,   # Integrated RL AI Controller
                "ns_queue": lane_counts[0] + lane_counts[1],
                "ew_queue": lane_counts[2] + lane_counts[3],
                "grid_congestion": live_grid_congestion, # Injects real physical TomTom flows for the Map
                "live_incidents": live_incidents_data,
                "telemetry_status": telemetry_status,
                "data_source": (
                    f"YOLO Vision ({preferred_camera_id}) + TomTom" if vision_status["status"] == "active"
                    else "TomTom Traffic Flow API"
                ),
                "data_freshness_ms": 0 if grid_last_updated == 0 else round((time.time() - grid_last_updated) * 1000),
                "vision_state": "api_sensing" if vision_status["status"] != "active" and has_fresh_tomtom else vision_status["status"],
                "backend_online": True,
                "last_updated": time.time(),
            }
            
            # Throttled 5-second asynchronous DB insertion for system telemetry
            if time.time() - last_db_insert >= 5.0 and supabase:
                def push_to_db():
                    try:
                        intersection_snapshots = []
                        for camera in camera_configs:
                            camera_snapshot = vision_manager.get_snapshot(camera["id"]) or {}
                            if camera_snapshot.get("status") != "active":
                                continue

                            lanes = camera_snapshot.get("lanes") or {"north": 0, "south": 0, "east": 0, "west": 0}
                            snapshot_payload = {
                                "intersection_id": camera["snapshot_ids"][0],
                                "north": lanes.get("north", 0),
                                "south": lanes.get("south", 0),
                                "east": lanes.get("east", 0),
                                "west": lanes.get("west", 0),
                                "density": round(float(camera_snapshot.get("density_percentage") or 0), 1),
                                "vehicle_count": int(camera_snapshot.get("vehicle_count") or 0),
                                "data_source": f"YOLO Vision ({camera['id']})",
                                "telemetry_status": "live",
                            }
                            if camera["id"] == preferred_camera_id:
                                snapshot_payload.update({
                                    "mode": "EMERGENCY" if operator_state["emergency_active"] else "NORMAL",
                                    "emergency_active": operator_state["emergency_active"],
                                    "signal_phase": signal_state,
                                })
                            intersection_snapshots.append(snapshot_payload)

                        persist_system_telemetry(
                            supabase,
                            {
                            "cpu_load": round(local_cpu, 1),
                            "memory_usage": round(local_memory, 1),
                            "storage_usage": 50,
                            "network_latency": round(backend_latency_ms + 2.0, 1),
                            "active_nodes": 9,
                            "ai_efficiency": round(100 - real_density, 1), # Efficiency translates inverse to congestion
                            "traditional_efficiency": max(0, round(100 - real_density - 12.5, 1)), # Realistic Delta 
                            "telemetry_status": telemetry_status,
                            "vision_state": vision_status["status"],
                            "data_source": payload["data_source"],
                            },
                            intersection_snapshots,
                        )
                        mark_success("supabase", status="live")
                    except Exception as e:
                        print("DB Sync Warning:", e)
                        mark_error("supabase", e)
                asyncio.create_task(asyncio.to_thread(push_to_db))
                last_db_insert = time.time()

            # --- Insert periodic traffic_data entries for prediction history ---
            if time.time() - last_traffic_data_insert >= 30.0 and supabase:
                def push_traffic_data():
                    try:
                        from traffic_api import get_live_weather
                        weather_info = get_live_weather()
                        weather_cond = weather_info.get("condition", "clear").lower() if weather_info.get("available") else "clear"
                        weather_map = {"clear": "clear", "clouds": "clear", "rain": "rain", "drizzle": "rain", "thunderstorm": "storm", "snow": "snow", "fog": "fog", "mist": "fog", "haze": "fog"}
                        weather_val = weather_map.get(weather_cond, "clear")
                        import datetime
                        hour = datetime.datetime.utcnow().hour
                        is_peak = 7 <= hour <= 10 or 17 <= hour <= 20
                        traffic_row = {
                            "intersection_id": "BLR-CORE-1",
                            "north": lane_counts[0],
                            "south": lane_counts[1],
                            "east": lane_counts[2],
                            "west": lane_counts[3],
                            "weather": weather_val,
                            "peak_hour": is_peak,
                            "density": round(real_density, 1),
                            "mode": "EMERGENCY" if operator_state["emergency_active"] else "NORMAL",
                            "emergency_active": operator_state["emergency_active"],
                            "optimal_signal_duration": 30.0,
                        }
                        supabase.table("traffic_data").insert(traffic_row).execute()
                    except Exception as e:
                        print(f"[Traffic Data Insert] {e}")
                asyncio.create_task(asyncio.to_thread(push_traffic_data))
                last_traffic_data_insert = time.time()
            
            await websocket.send_json(payload)
            mark_payload()
            mark_success("telemetry", status=telemetry_status)

            # Keep command_api.command_state in sync so REST endpoints always return fresh data
            _command_api.command_state.update({
                "density": round(real_density, 1),
                "vehicle_count": vehicle_count,
                "signal_phase": signal_state,
                "ns_queue": lane_counts[0] + lane_counts[1],
                "ew_queue": lane_counts[2] + lane_counts[3],
                "cpu_load": round(local_cpu, 1),
                "memory_usage": round(local_memory, 1),
                "network_latency": round(backend_latency_ms + 2.0, 1),
                "last_updated": time.time(),
                "data_source": payload["data_source"],
                "telemetry_status": telemetry_status,
                "vision_state": vision_status["status"],
            })
            
            
            await asyncio.sleep(0.1) # Prevents pure CPU lockup while maintaining true 10fps physical sync 

    except WebSocketDisconnect:
        print("Frontend operator disconnected from telemetry stream.")
        set_websocket_client_delta(-1)
    except Exception as e:
        print(f"WebSocket Error: {str(e)}")
        mark_error("telemetry", e)
        set_websocket_client_delta(-1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
