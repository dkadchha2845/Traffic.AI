"""
simulation_api.py — live junction analysis API

The legacy /api/simulate routes are preserved for compatibility, but every
response is now built only from live external APIs or the latest stored/live
telemetry records. No simulated density curves, queue formulas, weather
multipliers, or static chatbot knowledge remain in this module.
"""

import datetime
import os
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from traffic_api import get_live_traffic_congestion, get_live_weather

router = APIRouter()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))

JUNCTIONS: dict[str, dict[str, Any]] = {
    "silk-board": {
        "name": "Silk Board Junction",
        "lat": 12.9176,
        "lon": 77.6238,
        "snapshot_ids": ["silk-board", "BLR-CORE-1"],
    },
    "marathahalli": {
        "name": "Marathahalli Bridge",
        "lat": 12.9591,
        "lon": 77.6975,
        "snapshot_ids": ["marathahalli"],
    },
    "hebbal": {
        "name": "Hebbal Flyover",
        "lat": 13.0354,
        "lon": 77.5971,
        "snapshot_ids": ["hebbal", "hebbal-flyover"],
    },
    "kr-puram": {
        "name": "KR Puram Bridge",
        "lat": 13.0068,
        "lon": 77.6994,
        "snapshot_ids": ["kr-puram"],
    },
    "ecity": {
        "name": "Electronic City Flyover",
        "lat": 12.8452,
        "lon": 77.6602,
        "snapshot_ids": ["ecity", "ecity-flyover"],
    },
    "outer-ring": {
        "name": "Outer Ring Road (ORR)",
        "lat": 12.9779,
        "lon": 77.7023,
        "snapshot_ids": ["outer-ring", "outer-ring-road"],
    },
    "majestic": {
        "name": "Majestic / KSR Station",
        "lat": 12.9775,
        "lon": 77.5706,
        "snapshot_ids": ["majestic"],
    },
    "koramangala": {
        "name": "Koramangala 4th Block",
        "lat": 12.9352,
        "lon": 77.6245,
        "snapshot_ids": ["koramangala"],
    },
    "indiranagar": {
        "name": "Indiranagar 100ft Rd",
        "lat": 12.9784,
        "lon": 77.6408,
        "snapshot_ids": ["indiranagar"],
    },
    "whitefield": {
        "name": "Whitefield Main Road",
        "lat": 12.9698,
        "lon": 77.7499,
        "snapshot_ids": ["whitefield"],
    },
}

JUNCTION_ALIASES = {
    "hebbal-flyover": "hebbal",
    "ecity-flyover": "ecity",
    "outer-ring-road": "outer-ring",
}


class SimulateRequest(BaseModel):
    junction_id: str = "silk-board"
    density: Optional[float] = None
    time_of_day: Optional[int] = None
    weather: Optional[str] = None
    event: Optional[str] = None
    emergency: Optional[bool] = None


def _utc_now() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _normalize_junction_id(junction_id: str) -> str:
    return JUNCTION_ALIASES.get(junction_id, junction_id)


def _get_junction(junction_id: str) -> dict[str, Any]:
    normalized = _normalize_junction_id(junction_id)
    junction = JUNCTIONS.get(normalized)
    if not junction:
        raise HTTPException(status_code=404, detail=f"Unknown junction_id '{junction_id}'.")
    return {"id": normalized, **junction}


def _get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client

        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        print(f"[simulation_api] Supabase unavailable: {exc}")
        return None


def _pick_latest_row(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    return max(rows, key=lambda row: row.get("created_at") or "")


def _get_latest_db_row(table: str, intersection_ids: list[str]) -> dict[str, Any] | None:
    sb = _get_supabase()
    if not sb:
        return None

    rows: list[dict[str, Any]] = []
    for intersection_id in intersection_ids:
        try:
            result = (
                sb.table(table)
                .select("*")
                .eq("intersection_id", intersection_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                rows.append(result.data[0])
        except Exception as exc:
            print(f"[simulation_api] Query failed for {table}/{intersection_id}: {exc}")

    return _pick_latest_row(rows)


def _lane_queues_from_row(row: dict[str, Any]) -> dict[str, Optional[int]]:
    lane_queues: dict[str, Optional[int]] = {}
    for direction in ("north", "south", "east", "west"):
        value = row.get(direction)
        lane_queues[direction] = int(value) if isinstance(value, (int, float)) else None
    return lane_queues


def _axis_queues_from_lanes(lane_queues: dict[str, Optional[int]]) -> dict[str, Optional[int]]:
    north = lane_queues.get("north")
    south = lane_queues.get("south")
    east = lane_queues.get("east")
    west = lane_queues.get("west")
    return {
        "ns": (north or 0) + (south or 0) if north is not None or south is not None else None,
        "ew": (east or 0) + (west or 0) if east is not None or west is not None else None,
    }


def _build_snapshot_payload(row: dict[str, Any], source: str) -> dict[str, Any]:
    lane_queues = _lane_queues_from_row(row)
    axis_queues = _axis_queues_from_lanes(lane_queues)
    total_queue = None
    if any(value is not None for value in lane_queues.values()):
        total_queue = sum(value or 0 for value in lane_queues.values())

    vehicle_count = row.get("vehicle_count")
    if not isinstance(vehicle_count, (int, float)):
        vehicle_count = total_queue

    return {
        "available": True,
        "source": source,
        "recorded_at": row.get("created_at"),
        "vehicle_count": int(vehicle_count) if isinstance(vehicle_count, (int, float)) else None,
        "signal_phase": row.get("signal_phase"),
        "lane_queues": lane_queues,
        "axis_queues": axis_queues,
        "total_queue_vehicles": total_queue,
        "telemetry_status": row.get("telemetry_status"),
        "mode": row.get("mode"),
        "emergency_active": row.get("emergency_active"),
    }


def _get_command_snapshot(junction_id: str) -> dict[str, Any] | None:
    if junction_id != "silk-board":
        return None

    try:
        import command_api as _command_api
    except Exception as exc:
        print(f"[simulation_api] Command state unavailable: {exc}")
        return None

    state = _command_api.command_state
    last_updated = float(state.get("last_updated") or 0)
    if not last_updated or time.time() - last_updated > 30:
        return None

    ns_queue = state.get("ns_queue")
    ew_queue = state.get("ew_queue")
    total_queue = None
    if isinstance(ns_queue, (int, float)) or isinstance(ew_queue, (int, float)):
        total_queue = int(ns_queue or 0) + int(ew_queue or 0)

    return {
        "available": True,
        "source": "command_state",
        "recorded_at": datetime.datetime.utcfromtimestamp(last_updated).replace(microsecond=0).isoformat() + "Z",
        "vehicle_count": int(state["vehicle_count"]) if isinstance(state.get("vehicle_count"), (int, float)) else None,
        "signal_phase": state.get("signal_phase"),
        "lane_queues": {"north": None, "south": None, "east": None, "west": None},
        "axis_queues": {
            "ns": int(ns_queue) if isinstance(ns_queue, (int, float)) else None,
            "ew": int(ew_queue) if isinstance(ew_queue, (int, float)) else None,
        },
        "total_queue_vehicles": total_queue,
        "telemetry_status": state.get("telemetry_status"),
        "mode": state.get("mode"),
        "emergency_active": state.get("emergency_active"),
    }


def _get_latest_snapshot(junction: dict[str, Any]) -> dict[str, Any]:
    intersection_ids = list(dict.fromkeys(junction.get("snapshot_ids", [junction["id"]])))

    latest_system_snapshot = _get_latest_db_row("intersection_snapshots", intersection_ids)
    if latest_system_snapshot:
        return _build_snapshot_payload(latest_system_snapshot, "intersection_snapshots")

    latest_traffic_snapshot = _get_latest_db_row("traffic_data", intersection_ids)
    if latest_traffic_snapshot:
        return _build_snapshot_payload(latest_traffic_snapshot, "traffic_data")

    command_snapshot = _get_command_snapshot(junction["id"])
    if command_snapshot:
        return command_snapshot

    return {
        "available": False,
        "source": "Unavailable",
        "recorded_at": None,
        "vehicle_count": None,
        "signal_phase": None,
        "lane_queues": {"north": None, "south": None, "east": None, "west": None},
        "axis_queues": {"ns": None, "ew": None},
        "total_queue_vehicles": None,
        "telemetry_status": None,
        "mode": None,
        "emergency_active": None,
    }


def _compute_data_status(traffic: dict[str, Any], weather: dict[str, Any], snapshot: dict[str, Any]) -> str:
    available_sources = sum(
        1
        for source_available in (
            traffic.get("available"),
            weather.get("available"),
            snapshot.get("available"),
        )
        if source_available
    )
    if available_sources >= 2:
        return "live"
    if available_sources == 1:
        return "partial"
    return "unavailable"


def _build_summary(junction: dict[str, Any], traffic: dict[str, Any], weather: dict[str, Any], snapshot: dict[str, Any]) -> str:
    summary_parts: list[str] = [f"{junction['name']} live analysis:"]

    if traffic.get("available"):
        density_text = f"{traffic['density_pct']}%" if traffic.get("density_pct") is not None else "unavailable"
        speed_text = f"{traffic['current_speed_kmph']} km/h" if traffic.get("current_speed_kmph") is not None else "unavailable"
        free_flow_text = (
            f"{traffic['free_flow_speed_kmph']} km/h" if traffic.get("free_flow_speed_kmph") is not None else "unavailable"
        )
        summary_parts.append(
            f"TomTom reports {density_text} congestion at {speed_text} "
            f"(free-flow {free_flow_text})."
        )
    else:
        summary_parts.append("TomTom traffic flow is currently unavailable.")

    if weather.get("available"):
        temp = weather.get("temp_c")
        temp_text = f" at {temp}°C" if temp is not None else ""
        summary_parts.append(
            f"OpenWeatherMap reports {weather.get('condition') or 'unavailable'}{temp_text}."
        )
    else:
        summary_parts.append("Live weather is currently unavailable.")

    if snapshot.get("available"):
        details: list[str] = []
        if snapshot.get("vehicle_count") is not None:
            details.append(f"{snapshot['vehicle_count']} vehicles observed")
        if snapshot.get("signal_phase"):
            details.append(f"signal phase {snapshot['signal_phase']}")
        if snapshot.get("axis_queues", {}).get("ns") is not None or snapshot.get("axis_queues", {}).get("ew") is not None:
            details.append(
                f"queues NS={snapshot['axis_queues'].get('ns') if snapshot['axis_queues'].get('ns') is not None else '—'}, "
                f"EW={snapshot['axis_queues'].get('ew') if snapshot['axis_queues'].get('ew') is not None else '—'}"
            )
        snapshot_line = f"Latest stored telemetry from {snapshot['source']}"
        if snapshot.get("recorded_at"):
            snapshot_line += f" at {snapshot['recorded_at']}"
        if details:
            snapshot_line += ": " + ", ".join(details) + "."
        else:
            snapshot_line += "."
        summary_parts.append(snapshot_line)
    else:
        summary_parts.append("No junction-specific queue or signal snapshot is currently stored.")

    return " ".join(summary_parts)


def _ignored_inputs(req: SimulateRequest) -> list[str]:
    ignored: list[str] = []
    if req.density is not None:
        ignored.append("density")
    if req.time_of_day is not None:
        ignored.append("time_of_day")
    if req.weather is not None:
        ignored.append("weather")
    if req.event not in (None, "", "none"):
        ignored.append("event")
    if req.emergency:
        ignored.append("emergency")
    return ignored


def build_live_junction_analysis(junction_id: str, ignored_inputs: Optional[list[str]] = None) -> dict[str, Any]:
    junction = _get_junction(junction_id)
    traffic = get_live_traffic_congestion(junction["lat"], junction["lon"])
    weather = get_live_weather(junction["lat"], junction["lon"])
    snapshot = _get_latest_snapshot(junction)

    data_status = _compute_data_status(traffic, weather, snapshot)
    if data_status == "unavailable":
        raise HTTPException(
            status_code=503,
            detail=f"Live telemetry unavailable for {junction['name']}. No fallback simulation data is returned.",
        )

    traffic_payload = {
        "available": traffic.get("available", False),
        "density_pct": traffic.get("congestion_level"),
        "current_speed_kmph": traffic.get("current_speed"),
        "free_flow_speed_kmph": traffic.get("free_flow_speed"),
        "source": traffic.get("source", "Unavailable"),
    }
    weather_payload = {
        "available": weather.get("available", False),
        "condition": weather.get("condition"),
        "temp_c": weather.get("temp"),
        "visibility_m": weather.get("visibility"),
        "source": weather.get("source", "Unavailable"),
    }

    return {
        "junction": junction["name"],
        "junction_id": junction["id"],
        "analysis_at": _utc_now(),
        "data_status": data_status,
        "ignored_inputs": ignored_inputs or [],
        "traffic": traffic_payload,
        "weather": weather_payload,
        "snapshot": snapshot,
        "summary": _build_summary(junction, traffic_payload, weather_payload, snapshot),
    }


def build_live_chat_response(message: str, junction_id: str) -> dict[str, Any]:
    try:
        analysis = build_live_junction_analysis(junction_id)
    except HTTPException as exc:
        return {
            "response": exc.detail,
            "live_context": f"{junction_id}: live telemetry unavailable",
            "junction": junction_id,
            "congestion_pct": None,
            "timestamp": _utc_now(),
        }

    query = message.lower()
    traffic = analysis["traffic"]
    weather = analysis["weather"]
    snapshot = analysis["snapshot"]

    if any(token in query for token in ("signal", "phase", "green", "light")):
        if snapshot.get("signal_phase"):
            response = f"Current live signal phase at {analysis['junction']} is {snapshot['signal_phase']}."
            ns_queue = snapshot.get("axis_queues", {}).get("ns")
            ew_queue = snapshot.get("axis_queues", {}).get("ew")
            if ns_queue is not None or ew_queue is not None:
                response += (
                    f" Latest queued vehicles: NS={ns_queue if ns_queue is not None else '—'}, "
                    f"EW={ew_queue if ew_queue is not None else '—'}."
                )
            else:
                response += " No live queue snapshot is currently stored for that junction."
        else:
            response = f"No live signal-phase record is currently stored for {analysis['junction']}."
    elif any(token in query for token in ("weather", "rain", "temperature", "visibility")):
        if weather.get("available"):
            temp_suffix = f" {weather['temp_c']}°C" if weather.get("temp_c") is not None else ""
            response = (
                f"Live weather at {analysis['junction']}: {weather['condition']}{temp_suffix}."
            )
            if weather.get("visibility_m") is not None:
                response += f" Visibility: {weather['visibility_m']} m."
        else:
            response = f"Live weather is currently unavailable for {analysis['junction']}."
    elif any(token in query for token in ("route", "alternate", "bypass", "avoid")):
        if traffic.get("available"):
            response = (
                f"Live route guidance is not connected in this backend. Current observed conditions at {analysis['junction']}: "
                f"{traffic['density_pct']}% congestion and {traffic['current_speed_kmph']} km/h."
            )
        else:
            response = f"Live route guidance and traffic flow are both unavailable for {analysis['junction']}."
    elif any(token in query for token in ("emergency", "ambulance", "fire", "accident")):
        emergency_state = snapshot.get("emergency_active")
        response = (
            f"Emergency mode at {analysis['junction']} is "
            f"{'active' if emergency_state else 'not active' if emergency_state is not None else 'not currently reported'}."
        )
        if snapshot.get("signal_phase"):
            response += f" Current signal phase: {snapshot['signal_phase']}."
    else:
        response = analysis["summary"]

    live_context_parts = [analysis["junction"]]
    if traffic.get("density_pct") is not None:
        live_context_parts.append(f"Traffic {traffic['density_pct']}%")
    if traffic.get("current_speed_kmph") is not None:
        live_context_parts.append(f"Speed {traffic['current_speed_kmph']} km/h")
    if weather.get("condition"):
        live_context_parts.append(f"Weather {weather['condition']}")

    return {
        "response": response,
        "live_context": " · ".join(live_context_parts),
        "junction": analysis["junction"],
        "congestion_pct": traffic.get("density_pct"),
        "timestamp": analysis["analysis_at"],
    }


@router.post("/api/simulate")
def run_simulation(req: SimulateRequest):
    """Return live junction analysis from real telemetry sources only."""
    return build_live_junction_analysis(req.junction_id, ignored_inputs=_ignored_inputs(req))


@router.get("/api/simulate/autofill")
def autofill_simulation(junction_id: str = "silk-board"):
    """Return live values for the junction analysis panel."""
    analysis = build_live_junction_analysis(junction_id)
    return {
        "junction_id": analysis["junction_id"],
        "junction_name": analysis["junction"],
        "updated_at": analysis["analysis_at"],
        "data_status": analysis["data_status"],
        "density": analysis["traffic"]["density_pct"],
        "current_speed_kmph": analysis["traffic"]["current_speed_kmph"],
        "free_flow_speed_kmph": analysis["traffic"]["free_flow_speed_kmph"],
        "traffic_source": analysis["traffic"]["source"],
        "weather": analysis["weather"]["condition"],
        "temp_c": analysis["weather"]["temp_c"],
        "visibility_m": analysis["weather"]["visibility_m"],
        "weather_source": analysis["weather"]["source"],
        "vehicle_count": analysis["snapshot"]["vehicle_count"],
        "signal_phase": analysis["snapshot"]["signal_phase"],
        "snapshot_recorded_at": analysis["snapshot"]["recorded_at"],
        "snapshot_source": analysis["snapshot"]["source"],
        "axis_queues": analysis["snapshot"]["axis_queues"],
        "lane_queues": analysis["snapshot"]["lane_queues"],
    }


@router.get("/api/junctions")
def list_junctions():
    """Return all supported junctions for live analysis."""
    return [{"id": junction_id, "name": junction["name"]} for junction_id, junction in JUNCTIONS.items()]
