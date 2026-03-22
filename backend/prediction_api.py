"""
prediction_api.py — Traffic Prediction & Emergency Corridors API
Implements:
  - /api/predict  : 30-minute traffic congestion forecast (ARIMA + Bangalore baseline)
  - /api/emergency/corridor : Green-wave emergency vehicle corridor routing
  - /api/incidents : Incident anomaly detection from density deltas
"""

import math
import time
import datetime
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bangalore_api import build_zone_snapshots
from supabase.client import create_client, Client

router = APIRouter()

MAJOR_JUNCTIONS = [
    {"id": "silk-board", "name": "Silk Board Junction", "lat": 12.9176, "lon": 77.6238},
    {"id": "marathahalli", "name": "Marathahalli Bridge", "lat": 12.9591, "lon": 77.6975},
    {"id": "hebbal", "name": "Hebbal Flyover", "lat": 13.0354, "lon": 77.5971},
    {"id": "kr-puram", "name": "KR Puram Bridge", "lat": 13.0068, "lon": 77.6994},
    {"id": "ecity", "name": "Electronic City Flyover", "lat": 12.8452, "lon": 77.6602},
    {"id": "outer-ring", "name": "Outer Ring Road", "lat": 12.9779, "lon": 77.7023},
]

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _get_supabase() -> Client | None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        print(f"[prediction_api] Supabase unavailable: {exc}")
        return None


def _get_recent_density_history(limit: int = 12) -> list[float]:
    sb = _get_supabase()
    if not sb:
        return []
    try:
        rows = sb.table("intersection_snapshots").select("density").order("created_at", desc=True).limit(limit).execute().data or []
        values = [row.get("density") for row in reversed(rows) if isinstance(row.get("density"), (int, float))]
        return values
    except Exception as exc:
        print(f"[prediction_api] Density history unavailable: {exc}")
        return []


def _forecast_congestion(current_congestion: float, hours_ahead_minutes: int, history: list[float]) -> list[dict]:
    """
    Generates a 30-minute ahead forecast using recent live density history.
    """
    now = datetime.datetime.now()
    steps = hours_ahead_minutes // 5  # 5-minute intervals
    if len(history) >= 2:
        trend = history[-1] - history[-2]
    else:
        trend = 0.0

    results = []
    current_value = current_congestion
    for i in range(1, steps + 1):
        future_dt = now + datetime.timedelta(minutes=i * 5)
        projected = current_value + trend
        if history:
            observed_floor = min(history[-min(len(history), 6):])
            observed_ceiling = max(history[-min(len(history), 6):])
            lower_bound = max(0.0, observed_floor - 10)
            upper_bound = min(100.0, observed_ceiling + 10)
            final = max(lower_bound, min(upper_bound, projected))
        else:
            final = max(0.0, min(100.0, projected))
        current_value = final

        level = ("Critical" if final >= 80 else "High" if final >= 60
                 else "Medium" if final >= 35 else "Low")

        results.append({
            "time": future_dt.strftime("%H:%M"),
            "minutes_ahead": i * 5,
            "congestion_pct": round(final, 1),
            "level": level,
            "avg_speed_kmph": round(max(5, 55 * (1 - final / 100)), 1),
        })
    return results


@router.get("/api/predict")
def predict_traffic(current_congestion: float = 65.0, horizon_minutes: int = 30):
    """
    Predict traffic congestion for the next 30 minutes across Bangalore grid.
    Uses empirical Bangalore hourly patterns blended with the current live reading.
    """
    if horizon_minutes < 5 or horizon_minutes > 120:
        raise HTTPException(status_code=400, detail="horizon_minutes must be 5–120.")

    now = datetime.datetime.now()
    history = _get_recent_density_history()
    forecasts = _forecast_congestion(current_congestion, horizon_minutes, history)

    zone_snapshots = build_zone_snapshots()
    junction_forecasts = []
    trend_delta = forecasts[-1]["congestion_pct"] - current_congestion if forecasts else 0.0
    for zone in zone_snapshots:
        if not zone.get("available"):
            continue
        base = zone["congestion_pct"]
        final_congestion = max(0, min(100, base + trend_delta))
        level = "Critical" if final_congestion >= 80 else "High" if final_congestion >= 60 else "Medium" if final_congestion >= 35 else "Low"
        junction_forecasts.append({
            "id": zone["id"],
            "name": zone["name"],
            "predicted_congestion_pct": final_congestion,
            "level": level,
            "predicted_speed_kmph": round(max(5, 55 * (1 - final_congestion / 100)), 1),
        })

    # AI recommendation
    peak_forecast = max(forecasts, key=lambda f: f["congestion_pct"])
    if peak_forecast["congestion_pct"] >= 80:
        recommendation = f"⚠ Critical congestion predicted at {peak_forecast['time']}. Activate emergency signal protocols."
    elif peak_forecast["congestion_pct"] >= 60:
        recommendation = f"🔶 High congestion expected at {peak_forecast['time']}. Extend green phases by 25–30s."
    else:
        recommendation = "✅ Traffic conditions expected to remain manageable. Maintain baseline signal timing."

    return {
        "current_congestion_pct": current_congestion,
        "forecast_generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "horizon_minutes": horizon_minutes,
        "5min_intervals": forecasts,
        "junction_forecasts": junction_forecasts,
        "peak_predicted_congestion": peak_forecast["congestion_pct"],
        "peak_predicted_time": peak_forecast["time"],
        "ai_recommendation": recommendation,
        "model": "Live Trend Projection",
    }


class EmergencyRequest(BaseModel):
    vehicle_type: str = "Ambulance"
    origin_junction: str = "silk-board"
    destination_junction: str = "hebbal"
    priority: int = 1  # 1=highest


@router.post("/api/emergency/corridor")
def create_emergency_corridor(req: EmergencyRequest):
    """
    Creates a green-wave emergency vehicle corridor between two junctions.
    Returns signal override plan for the corridor route.
    """
    # Find origin and destination
    origin = next((j for j in MAJOR_JUNCTIONS if j["id"] == req.origin_junction), MAJOR_JUNCTIONS[0])
    dest = next((j for j in MAJOR_JUNCTIONS if j["id"] == req.destination_junction), MAJOR_JUNCTIONS[2])

    # Simple routing (in real system: Dijkstra on road graph)
    intermediate = [j for j in MAJOR_JUNCTIONS
                    if j["id"] not in (req.origin_junction, req.destination_junction)][:2]
    corridor = [origin] + intermediate + [dest]

    signal_plan = []
    for i, junction in enumerate(corridor):
        signal_plan.append({
            "junction_id": junction["id"],
            "junction_name": junction["name"],
            "override": "FULL_GREEN",
            "duration_seconds": 120,
            "sequence": i + 1,
            "activation_delay_seconds": i * 30,  # cascade green-wave timing
        })

    return {
        "corridor_id": f"EMG-{int(time.time())}",
        "vehicle_type": req.vehicle_type,
        "priority_level": req.priority,
        "origin": origin["name"],
        "destination": dest["name"],
        "estimated_travel_time_minutes": len(corridor) * 2.5,
        "signal_overrides": signal_plan,
        "status": "CORRIDOR_ACTIVATED",
        "message": f"Green wave corridor established: {origin['name']} → {dest['name']}. {len(signal_plan)} signals overridden.",
    }


@router.get("/api/incidents/detect")
def detect_incidents(current_density: float = 65.0, previous_density: float = 55.0):
    """
    Detects potential traffic incidents from sudden density spike anomalies.
    A >20% sudden increase in density is flagged as a potential incident.
    """
    delta = current_density - previous_density
    now = datetime.datetime.now()

    incidents = []
    if delta >= 20:
        severity = "CRITICAL" if delta >= 35 else "HIGH"
        incidents.append({
            "type": "SuddenCongestionSpike",
            "severity": severity,
            "detected_at": now.strftime("%Y-%m-%d %H:%M:%S"),
            "delta_pct": round(delta, 1),
            "affected_area": "BLR-CORE-1 (Primary Camera Node)",
            "recommendation": "Verify via CCTV. Dispatch traffic personnel if spike persists >3min.",
        })

    # Peak hour overload detection
    hour = now.hour
    if 7 <= hour <= 10 or 17 <= hour <= 21:
        if current_density >= 85:
            incidents.append({
                "type": "PeakHourGridlock",
                "severity": "HIGH",
                "detected_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                "delta_pct": None,
                "affected_area": "Silk Board — Marathahalli ORR stretch",
                "recommendation": "Activate adaptive signal extension. Alert BMTC for alternate bus routes.",
            })

    return {
        "incident_count": len(incidents),
        "incidents": incidents,
        "monitoring_status": "ACTIVE",
        "checked_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    }


@router.get("/api/alerts/public")
def get_public_alerts(current_density: float = 65.0):
    """Public traffic alerts for drivers. Shown in the dashboard notification panel."""
    hour = datetime.datetime.now().hour
    alerts = []

    if current_density >= 80:
        alerts.append({"type": "SEVERE_CONGESTION", "message": "Severe congestion on Silk Board–ORR corridor. Use alternate Hosur Road.", "priority": 1})
    if 7 <= hour <= 10:
        alerts.append({"type": "PEAK_HOURS", "message": "Morning peak hours in effect (7–10 AM). Expect 20–30 min delays at major junctions.", "priority": 2})
    if 17 <= hour <= 21:
        alerts.append({"type": "PEAK_HOURS", "message": "Evening peak hours in effect (5–9 PM). Heavy congestion on Ring Roads.", "priority": 2})
    if current_density >= 70:
        alerts.append({"type": "ROUTING_SUGGESTION", "message": "Alternate route via Mysore Road active. BMTC buses on diversion.", "priority": 3})

    if not alerts:
        alerts.append({"type": "ALL_CLEAR", "message": "Traffic conditions normal across Bangalore grid.", "priority": 5})

    return {"alerts": alerts, "count": len(alerts), "generated_at": datetime.datetime.now().strftime("%H:%M:%S")}
