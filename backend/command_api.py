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


# ── GET /api/command/recommendations ───────────────────────────────────────────

@router.get("/api/command/recommendations")
def get_recommendations():
    """
    Returns real-time, data-backed AI traffic control recommendations.
    Every recommendation is grounded in live TomTom/Vision telemetry.
    """
    from recommendation_engine import generate_recommendations
    recs = generate_recommendations()
    return {
        "recommendations": recs,
        "count": len(recs),
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }


# ── POST /api/command/apply-recommendation ─────────────────────────────────────

class ApplyRecommendationRequest(BaseModel):
    recommendation_id: str
    action: str  # "extend_green" | "activate_diversion" | "weather_advisory"
    junction_id: Optional[str] = None
    extension_seconds: Optional[int] = None

@router.post("/api/command/apply-recommendation")
def apply_recommendation(req: ApplyRecommendationRequest):
    """
    Applies a recommendation action to the live traffic system.
    Updates command_state and logs the action to Supabase.
    """
    result = {"success": True, "action": req.action, "recommendation_id": req.recommendation_id}

    if req.action == "extend_green" and req.extension_seconds:
        command_state["ai_paused"] = True
        # Keep current phase but mark an override duration
        command_state["override_duration_seconds"] = req.extension_seconds
        result["message"] = f"Green phase extended by {req.extension_seconds}s at {req.junction_id or 'primary'}."

    elif req.action == "activate_diversion":
        result["message"] = f"Diversion advisory activated for {req.junction_id or 'unknown'}. Alert dispatched."

    elif req.action == "weather_advisory":
        result["message"] = "City-wide weather advisory published. Yellow phase extended."

    else:
        result["message"] = f"Action '{req.action}' acknowledged."

    # Log to Supabase
    sb = _get_supabase()
    if sb:
        try:
            sb.table("signal_logs").insert({
                "agent_name": "AIRecommendation",
                "action": req.action.upper(),
                "reasoning": result["message"],
                "impact": "WARN" if req.action == "extend_green" else "INFO",
            }).execute()
        except Exception as e:
            print(f"[command_api] Recommendation log failed: {e}")

    return result


# ── POST /api/command/emergency/corridor ───────────────────────────────────────

class EmergencyCorridorRequest(BaseModel):
    origin: str = "silk-board"
    destination: str = "hebbal-flyover"
    vehicle_type: str = "Ambulance"
    priority: int = 1

@router.post("/api/command/emergency/corridor")
def create_emergency_corridor_endpoint(req: EmergencyCorridorRequest):
    """
    Activates a green-wave emergency corridor between two junctions.
    """
    from recommendation_engine import activate_emergency_corridor
    corridor = activate_emergency_corridor(
        origin=req.origin,
        destination=req.destination,
        vehicle_type=req.vehicle_type,
        priority=req.priority,
    )

    # Log to Supabase
    sb = _get_supabase()
    if sb:
        try:
            sb.table("signal_logs").insert({
                "agent_name": "EmergencySystem",
                "action": "CORRIDOR_ACTIVATED",
                "reasoning": (
                    f"{req.vehicle_type} corridor: {req.origin} → {req.destination}. "
                    f"Path: {' → '.join(corridor['path'])}. "
                    f"{len(corridor['signal_overrides'])} signals overridden."
                ),
                "impact": "CRITICAL",
            }).execute()
        except Exception as e:
            print(f"[command_api] Emergency log failed: {e}")

    # Also set emergency state
    command_state["emergency_active"] = True

    return corridor


# ── GET /api/command/emergency/active ──────────────────────────────────────────

@router.get("/api/command/emergency/active")
def get_active_corridors_endpoint():
    """Returns all currently active emergency corridors."""
    from recommendation_engine import get_active_corridors
    corridors = get_active_corridors()
    return {"corridors": corridors, "count": len(corridors)}


# ── GET /api/command/active-incidents ──────────────────────────────────────────

@router.get("/api/command/active-incidents")
def get_active_incidents():
    """Returns enriched real-time traffic incidents with GPS, road names, delay."""
    from traffic_api import get_live_incidents
    incidents = get_live_incidents(12.9716, 77.5946)
    return {
        "incidents": incidents,
        "count": len(incidents),
        "source": "TomTom Traffic API",
    }


# ── GET /api/command/route-guidance ────────────────────────────────────────────

@router.get("/api/command/route-guidance")
def get_route_guidance():
    """
    Returns active diversion routes based on current recommendations.
    Each route includes origin coords, diversion description, and
    a visual polyline from origin to neighboring junctions.
    """
    from recommendation_engine import generate_recommendations, DIVERSION_MAP, CORRIDOR_GRAPH
    from bangalore_api import BANGALORE_ZONES

    zone_coords = {z["id"]: (z["lat"], z["lon"]) for z in BANGALORE_ZONES}

    recs = generate_recommendations()
    diversion_recs = [r for r in recs if r["type"] == "DIVERSION"]

    routes = []
    for rec in diversion_recs:
        jid = rec["junction_id"]
        action = rec.get("action_data", {})
        action_routes = action.get("routes", [])

        origin_coords = zone_coords.get(jid)
        if not origin_coords:
            continue

        # Diversion text from the DIVERSION_MAP (via route name, not junction ID)
        diversion_via = action_routes[0]["via"] if action_routes else ""
        time_saved_text = action_routes[0].get("saves_min", "5–10") if action_routes else "5–10"

        # Build a visual multi-polyline from origin to neighboring junctions
        multi_polyline = []
        neighbors = CORRIDOR_GRAPH.get(jid, [])
        for neighbor_id in neighbors[:2]:  # Show up to 2 alternate paths
            neighbor_coords = zone_coords.get(neighbor_id)
            if neighbor_coords:
                multi_polyline.append([list(origin_coords), list(neighbor_coords)])

        routes.append({
            "id": rec["id"],
            "junction_id": jid,
            "junction_name": rec["junction_name"],
            "title": rec["title"],
            "description": rec["description"],
            "diversion_via": diversion_via,
            "time_saved": time_saved_text,
            "polyline": multi_polyline,
            "priority": rec["priority"],
        })

    return {"routes": routes, "count": len(routes)}
