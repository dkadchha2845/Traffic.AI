"""
command_api.py — Command Center REST API

Provides REST fallback for the Command Center page when the WebSocket is fully
connected but also exposes stateful control endpoints.

Endpoints:
  GET  /api/command/status    — current traffic snapshot (vehicle count, congestion, speed, signal)
  POST /api/command/control   — operator overrides (mode, emergency, force_phase)
  GET  /api/command/logs      — latest signal_logs from Supabase
  POST /api/command/simulate  — return live junction analysis
  POST /api/command/chat      — AI chatbot using live traffic context (no auth wall)
"""

import os
import time
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from traffic_api import get_live_traffic_congestion, get_live_weather
from runtime_state import get_runtime_snapshot

router = APIRouter()

# ── Shared state (written by WebSocket handler in main.py) ─────────────────────
# These are module-level globals that main.py can update so the REST endpoints
# always reflect the latest vision/RL state without an extra API round-trip.
command_state: dict = {
    "density": 0.0,
    "vehicle_count": 0,
    "signal_phase": "NS_GREEN",
    "ns_queue": 0,
    "ew_queue": 0,
    "cpu_load": 0.0,
    "memory_usage": 0.0,
    "network_latency": 0.0,
    "emergency_active": False,
    "ai_paused": False,
    "mode": "NORMAL",
    "last_updated": 0.0,
}

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))


def _get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[command_api] Supabase unavailable: {e}")
        return None


# ── GET /api/command/status ────────────────────────────────────────────────────

@router.get("/api/command/status")
def get_command_status():
    """
    Returns the latest Command Center snapshot.
    Combines cached WebSocket vision state with a fresh TomTom congestion call.
    """
    density = command_state["density"]
    vehicle_count = command_state["vehicle_count"]
    signal_phase = command_state["signal_phase"]

    # If WebSocket hasn't pushed any data yet (fresh start), fetch from TomTom
    if command_state["last_updated"] == 0 or (time.time() - command_state["last_updated"] > 30):
        live = get_live_traffic_congestion(12.9176, 77.6238)  # Silk Board as default
        density = live["congestion_level"]
        data_source = live["source"]
    else:
        data_source = "YOLO Vision + RL Model + TomTom"

    avg_speed = max(5, round(55 * (1 - density / 100))) if isinstance(density, (int, float)) else None
    congestion_label = (
        "CRITICAL" if density > 80 else
        "HIGH"     if density > 60 else
        "MEDIUM"   if density > 40 else
        "LOW"
    ) if isinstance(density, (int, float)) else "UNAVAILABLE"

    runtime = get_runtime_snapshot()
    if runtime["telemetry"].get("status") == "offline" and command_state["last_updated"] == 0:
        data_source = "Unavailable"

    return {
        "status": "online" if runtime["telemetry"].get("status") != "offline" else "degraded",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "vehicle_count": vehicle_count,
        "density_pct": round(density, 1) if isinstance(density, (int, float)) else None,
        "congestion_level": congestion_label,
        "avg_speed_kmph": avg_speed,
        "signal_phase": signal_phase,
        "ns_queue": command_state["ns_queue"],
        "ew_queue": command_state["ew_queue"],
        "cpu_load": command_state["cpu_load"],
        "memory_usage": command_state["memory_usage"],
        "network_latency_ms": command_state["network_latency"],
        "emergency_active": command_state["emergency_active"],
        "ai_paused": command_state["ai_paused"],
        "mode": command_state["mode"],
        "data_source": data_source,
        "telemetry_status": runtime["telemetry"].get("status", "offline"),
        "vision_state": runtime["vision"].get("status", "unknown"),
    }


# ── POST /api/command/control ──────────────────────────────────────────────────

class ControlRequest(BaseModel):
    mode: Optional[str] = None           # "NORMAL" | "PEAK" | "RAIN"
    emergency: Optional[bool] = None     # activate emergency corridor
    force_phase: Optional[str] = None    # "NS_GREEN" | "EW_GREEN" | None (AI)
    ai_paused: Optional[bool] = None     # pause AI and use manual phase


@router.post("/api/command/control")
def post_command_control(req: ControlRequest):
    """
    Accepts operator overrides from the Command Center control panel.
    Updates the shared state that the WebSocket reads on each loop.
    """
    if req.mode is not None:
        command_state["mode"] = req.mode

    if req.emergency is not None:
        command_state["emergency_active"] = req.emergency

    if req.force_phase is not None:
        command_state["signal_phase"] = req.force_phase
        command_state["ai_paused"] = True
    elif req.ai_paused is not None:
        command_state["ai_paused"] = req.ai_paused
        if not req.ai_paused:
            command_state["signal_phase"] = "NS_GREEN"  # let AI resume

    # Log to Supabase
    sb = _get_supabase()
    if sb:
        try:
            sb.table("signal_logs").insert({
                "agent_name": "ControlPanel",
                "action": "OPERATOR_OVERRIDE",
                "reasoning": f"Operator set mode={command_state['mode']} emergency={command_state['emergency_active']} ai_paused={command_state['ai_paused']}",
                "impact": "WARN"
            }).execute()
        except Exception as e:
            print(f"[command_api] Log insert failed: {e}")

    return {
        "success": True,
        "applied": {
            "mode": command_state["mode"],
            "emergency_active": command_state["emergency_active"],
            "ai_paused": command_state["ai_paused"],
            "signal_phase": command_state["signal_phase"],
        }
    }


# ── GET /api/command/logs ──────────────────────────────────────────────────────

@router.get("/api/command/logs")
def get_command_logs(limit: int = 50):
    """
    Returns the latest signal_logs from Supabase.
    Falls back to an honest empty list if DB is unavailable.
    """
    sb = _get_supabase()
    if sb:
        try:
            resp = sb.table("signal_logs") \
                .select("id, created_at, log_type, agent_name, action, message") \
                .order("created_at", desc=True) \
                .limit(limit) \
                .execute()
            return {"logs": resp.data, "total": len(resp.data)}
        except Exception as e:
            print(f"[command_api] Logs fetch failed: {e}")

    return {"logs": [], "total": 0}


# ── POST /api/command/simulate ─────────────────────────────────────────────────

class CommandSimRequest(BaseModel):
    junction_id: str = "silk-board"
    density: Optional[float] = None
    time_of_day: Optional[int] = None
    weather: Optional[str] = None
    event: str = "none"
    emergency: bool = False


@router.post("/api/command/simulate")
def post_command_simulate(req: CommandSimRequest):
    """
    Thin wrapper around the live junction analysis engine.
    """
    try:
        from simulation_api import build_live_junction_analysis

        ignored_inputs = []
        if req.density is not None:
            ignored_inputs.append("density")
        if req.time_of_day is not None:
            ignored_inputs.append("time_of_day")
        if req.weather is not None:
            ignored_inputs.append("weather")
        if req.event not in (None, "", "none"):
            ignored_inputs.append("event")
        if req.emergency:
            ignored_inputs.append("emergency")

        return build_live_junction_analysis(req.junction_id, ignored_inputs=ignored_inputs)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[command_api] Live junction analysis failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Live junction analysis unavailable for {req.junction_id}.",
        )
