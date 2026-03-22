import datetime
import os
from typing import Any

from fastapi import APIRouter, Query

import command_api as _command_api
from bangalore_api import build_zone_snapshots
from camera_config import get_camera_configs
from traffic_api import get_live_incidents, get_live_weather
from vision_runtime import vision_manager
from runtime_state import get_runtime_snapshot

router = APIRouter()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def _get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        print(f"[live_data_api] Supabase unavailable: {exc}")
        return None


def _safe_select(table: str, limit: int, intersection_id: str | None = None):
    sb = _get_supabase()
    if not sb:
        return []
    try:
        query = sb.table(table).select("*").order("created_at", desc=True).limit(limit)
        if intersection_id:
            query = query.eq("intersection_id", intersection_id)
        result = query.execute()
        return result.data or []
    except Exception as exc:
        print(f"[live_data_api] Query failed for {table}: {exc}")
        return []


def _get_latest_intersection_row(intersection_ids: list[str]):
    sb = _get_supabase()
    if not sb:
        return None

    latest_row = None
    for intersection_id in intersection_ids:
        for table in ("intersection_snapshots", "traffic_data"):
            try:
                result = (
                    sb.table(table)
                    .select("*")
                    .eq("intersection_id", intersection_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if not result.data:
                    continue
                row = dict(result.data[0])
                row["_table"] = table
                if latest_row is None or (row.get("created_at") or "") > (latest_row.get("created_at") or ""):
                    latest_row = row
            except Exception as exc:
                print(f"[live_data_api] Query failed for {table}/{intersection_id}: {exc}")

    return latest_row


@router.get("/api/system/metrics/history")
def get_system_metrics_history(limit: int = Query(default=20, ge=1, le=200)):
    rows = _safe_select("system_metrics", limit)
    return {"rows": list(reversed(rows)), "count": len(rows)}


@router.get("/api/system/intersections/history")
def get_system_intersections_history(limit: int = Query(default=50, ge=1, le=200), intersection_id: str | None = None):
    rows = _safe_select("intersection_snapshots", limit, intersection_id=intersection_id)
    return {"rows": rows, "count": len(rows)}


@router.get("/api/system/cameras")
def get_system_cameras():
    camera_configs = get_camera_configs()
    camera_zone_ids = [camera["zone_id"] for camera in camera_configs]
    zone_map = {zone["id"]: zone for zone in build_zone_snapshots(camera_zone_ids)}
    command_state = _command_api.command_state
    updated_at = datetime.datetime.utcnow().isoformat() + "Z"

    cameras = []
    command_last_updated = float(command_state.get("last_updated") or 0)
    command_is_fresh = bool(command_last_updated and (datetime.datetime.utcnow().timestamp() - command_last_updated) <= 30)

    for camera in camera_configs:
        zone = zone_map.get(camera["zone_id"])
        vision_snapshot = vision_manager.get_snapshot(camera["id"]) or {}
        latest_row = _get_latest_intersection_row(camera["snapshot_ids"])
        row_vehicle_count = None
        row_density = None
        row_signal_phase = None
        row_source = None
        row_recorded_at = None
        vision_recorded_at = None
        telemetry_status = None

        if latest_row:
            row_recorded_at = latest_row.get("created_at")
            row_source = latest_row.get("_table")
            telemetry_status = latest_row.get("telemetry_status")
            row_signal_phase = latest_row.get("signal_phase")
            if isinstance(latest_row.get("vehicle_count"), (int, float)):
                row_vehicle_count = int(latest_row["vehicle_count"])
            else:
                lane_values = [latest_row.get("north"), latest_row.get("south"), latest_row.get("east"), latest_row.get("west")]
                if any(isinstance(value, (int, float)) for value in lane_values):
                    row_vehicle_count = int(sum(int(value or 0) for value in lane_values))
            if isinstance(latest_row.get("density"), (int, float)):
                row_density = float(latest_row["density"])

        vehicle_count = row_vehicle_count
        congestion = row_density
        current_speed = zone.get("current_speed_kmph") if zone else None
        signal_phase = row_signal_phase
        data_sources: list[str] = []

        if row_source:
            data_sources.append(row_source)

        if vision_snapshot.get("status") == "active":
            if isinstance(vision_snapshot.get("vehicle_count"), (int, float)):
                vehicle_count = int(vision_snapshot["vehicle_count"])
            if isinstance(vision_snapshot.get("density_percentage"), (int, float)):
                congestion = float(vision_snapshot["density_percentage"])
            telemetry_status = telemetry_status or "live"
            data_sources.insert(0, "YOLO Vision")
            vision_recorded_at = (
                datetime.datetime.utcfromtimestamp(vision_snapshot["last_updated_at"]).replace(microsecond=0).isoformat() + "Z"
                if vision_snapshot.get("last_updated_at")
                else None
            )

        if camera["primary_stream"] and command_is_fresh:
            if vehicle_count is None and isinstance(command_state.get("vehicle_count"), (int, float)):
                vehicle_count = int(command_state["vehicle_count"])
            if congestion is None and isinstance(command_state.get("density"), (int, float)):
                congestion = float(command_state["density"])
            if signal_phase is None:
                signal_phase = command_state.get("signal_phase")
            telemetry_status = telemetry_status or command_state.get("telemetry_status")
            if command_state.get("data_source"):
                data_sources.append(str(command_state["data_source"]))

        if zone:
            if vehicle_count is None and isinstance(zone.get("vehicle_estimate"), (int, float)):
                vehicle_count = int(zone["vehicle_estimate"])
            if congestion is None and isinstance(zone.get("congestion_pct"), (int, float)):
                congestion = float(zone["congestion_pct"])
            if zone.get("data_source"):
                data_sources.append(str(zone["data_source"]))

        available = any(
            value is not None
            for value in (vehicle_count, congestion, current_speed, signal_phase)
        )
        if vision_snapshot.get("status") == "active":
            available = True

        vision_state = vision_snapshot.get("status") or ("telemetry_only" if available else "unavailable")

        zone_name = zone["name"] if zone else camera["zone_id"].replace("-", " ").title()
        zone_area = zone["area"] if zone else camera["area"]
        lat = zone.get("lat") if zone else None
        lon = zone.get("lon") if zone else None
        data_source = " + ".join(dict.fromkeys(source for source in data_sources if source and source != "Unavailable"))
        if not data_source:
            data_source = "Unavailable"
        camera_updated_at = vision_recorded_at or row_recorded_at or updated_at

        cameras.append({
            "id": camera["id"],
            "zone_id": camera["zone_id"],
            "name": zone_name,
            "area": zone_area,
            "lat": lat,
            "lon": lon,
            "vehicle_count": vehicle_count,
            "congestion": congestion,
            "current_speed_kmph": current_speed,
            "signal_phase": signal_phase,
            "stream_url": camera.get("source"),
            "stream_configured": bool(camera.get("source_configured")),
            "frame_endpoint": camera.get("frame_endpoint"),
            "vision_state": vision_state,
            "updated_at": camera_updated_at,
            "data_source": data_source,
            "available": available,
            "primary_stream": camera["primary_stream"],
            "telemetry_status": telemetry_status or ("live" if available else "offline"),
            "snapshot_recorded_at": camera_updated_at,
        })

    active_count = sum(1 for camera in cameras if camera["available"])
    return {"cameras": cameras, "count": len(cameras), "active_count": active_count, "updated_at": updated_at}


@router.get("/api/system/weather")
def get_system_weather():
    weather = get_live_weather(12.9716, 77.5946)
    return {
        "available": weather.get("available", False),
        "condition": weather.get("condition"),
        "temp": weather.get("temp"),
        "visibility": weather.get("visibility"),
        "source": weather.get("source", "Unavailable"),
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }


@router.get("/api/system/notifications")
def get_system_notifications(limit: int = Query(default=20, ge=1, le=100)):
    sb = _get_supabase()
    notifications: list[dict[str, Any]] = []

    if sb:
        try:
            logs = sb.table("signal_logs").select("*").order("created_at", desc=True).limit(limit).execute().data or []
            for log in logs:
                notifications.append({
                    "id": log.get("id"),
                    "title": log.get("action") or log.get("agent_name") or "System Event",
                    "message": log.get("message") or "",
                    "type": "alert" if log.get("log_type") in {"ERROR", "ALERT"} else "warning" if log.get("log_type") == "WARN" else "success" if log.get("log_type") == "SUCCESS" else "info",
                    "time": log.get("created_at"),
                    "read": False,
                    "source": "signal_logs",
                })
        except Exception as exc:
            print(f"[live_data_api] Notification logs unavailable: {exc}")

    incidents = get_live_incidents(12.9716, 77.5946)[:3]
    for idx, incident in enumerate(incidents):
        notifications.append({
            "id": f"incident-{idx}",
            "title": "Traffic Incident",
            "message": f"TomTom incident category {incident.get('properties', {}).get('iconCategory', 'unknown')} detected on the Bangalore grid.",
            "type": "alert",
            "time": datetime.datetime.utcnow().isoformat() + "Z",
            "read": False,
            "source": "tomtom_incidents",
        })

    notifications.sort(key=lambda item: item["time"] or "", reverse=True)
    return {"notifications": notifications[:limit], "count": len(notifications[:limit])}


@router.get("/api/system/network")
def get_system_network():
    zones = build_zone_snapshots()
    live_zones = [zone for zone in zones if zone.get("available")]
    runtime = get_runtime_snapshot()
    command_state = _command_api.command_state

    avg_congestion = round(sum(zone["congestion_pct"] for zone in live_zones) / len(live_zones), 1) if live_zones else None
    avg_speed = round(sum(zone["current_speed_kmph"] for zone in live_zones) / len(live_zones), 1) if live_zones else None

    return {
        "active_nodes": len(live_zones),
        "websocket_clients": runtime["websocket"].get("client_count", 0),
        "telemetry_status": runtime["telemetry"].get("status", "offline"),
        "vision_state": runtime["vision"].get("status", "unknown"),
        "network_latency_ms": command_state.get("network_latency", 0.0),
        "avg_congestion_pct": avg_congestion,
        "avg_speed_kmph": avg_speed,
        "zones": zones,
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
