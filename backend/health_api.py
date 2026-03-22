import os
import time
from fastapi import APIRouter
from pydantic import BaseModel
from runtime_state import get_runtime_snapshot

router = APIRouter()

class HealthStatus(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    supabase_connected: bool
    tomtom_configured: bool
    openai_configured: bool
    vision_active: bool
    websocket_running: bool
    data_source: str
    telemetry_status: str
    websocket_clients: int
    vision_state: str

@router.get("/api/health")
def check_health():
    """
    Returns the comprehensive health status of all backend systems.
    """
    sb_url = os.getenv("VITE_SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))
    tomtom_key = os.getenv("TOMTOM_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    supabase_ok = bool(sb_url and sb_key)
    tomtom_ok = bool(tomtom_key)
    openai_ok = bool(openai_key)

    runtime = get_runtime_snapshot()
    telemetry_state = runtime["telemetry"]
    websocket_state = runtime["websocket"]
    vision_state = runtime["vision"]
    traffic_state = runtime["traffic_api"]

    data_source = traffic_state.get("source") or ("TomTom Live API" if tomtom_ok else "Unavailable")

    return {
        "status": "online" if telemetry_state.get("status") != "offline" else "degraded",
        "version": "2.0.0",
        "uptime_seconds": runtime["uptime_seconds"],
        "supabase_connected": supabase_ok,
        "tomtom_configured": tomtom_ok,
        "openai_configured": openai_ok,
        "vision_active": vision_state.get("status") == "active",
        "websocket_running": websocket_state.get("client_count", 0) > 0 or telemetry_state.get("last_payload_at") is not None,
        "data_source": data_source,
        "telemetry_status": telemetry_state.get("status", "offline"),
        "websocket_clients": websocket_state.get("client_count", 0),
        "vision_state": vision_state.get("status", "unknown"),
        "dependencies": runtime,
    }

@router.get("/api/health/live")
def health_live():
    return {"status": "ok"}

@router.get("/api/health/ready")
def health_ready():
    runtime = get_runtime_snapshot()
    telemetry_ok = runtime["telemetry"].get("status") in {"live", "degraded", "stale"}
    return {
        "ready": telemetry_ok,
        "telemetry_status": runtime["telemetry"].get("status", "offline"),
        "vision_state": runtime["vision"].get("status", "unknown"),
    }

@router.get("/api/health/dependencies")
def health_dependencies():
    return get_runtime_snapshot()
