"""
bangalore_api.py — Bangalore Peak Traffic Zones API
Provides live congestion, speed, and action recommendations for major Bangalore junctions.
Data sourced from TomTom Traffic Flow API.
"""

import os
import requests
from fastapi import APIRouter
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")
TOMTOM_FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"

# Major Bangalore congestion points with real GPS coordinates
BANGALORE_ZONES = [
    {
        "id": "silk-board",
        "name": "Silk Board Junction",
        "lat": 12.9176, "lon": 77.6238,
        "area": "BTM Layout / Electronic City corridor",
        "peak_hours": "7–10 AM, 5–9 PM",
    },
    {
        "id": "marathahalli",
        "name": "Marathahalli Bridge",
        "lat": 12.9591, "lon": 77.6975,
        "area": "Outer Ring Road / Whitefield corridor",
        "peak_hours": "8–10 AM, 5–8 PM",
    },
    {
        "id": "kr-puram",
        "name": "KR Puram Bridge",
        "lat": 13.0068, "lon": 77.6994,
        "area": "Old Madras Road / Whitefield access",
        "peak_hours": "7–9 AM, 5–9 PM",
    },
    {
        "id": "ecity-flyover",
        "name": "Electronic City Flyover",
        "lat": 12.8452, "lon": 77.6602,
        "area": "Hosur Road / Tech Park access",
        "peak_hours": "8–10 AM, 5–8 PM",
    },
    {
        "id": "hebbal-flyover",
        "name": "Hebbal Flyover",
        "lat": 13.0354, "lon": 77.5971,
        "area": "NH-44 / Airport Road corridor",
        "peak_hours": "7–9 AM, 5–9 PM",
    },
    {
        "id": "outer-ring-road",
        "name": "Outer Ring Road (ORR)",
        "lat": 12.9779, "lon": 77.7023,
        "area": "Marathahalli–Sarjapur stretch",
        "peak_hours": "8–10 AM, 5–9 PM",
    },
    {
        "id": "koramangala",
        "name": "Koramangala Sony World",
        "lat": 12.9345, "lon": 77.6265,
        "area": "Koramangala inner ring",
        "peak_hours": "9–11 AM, 6–9 PM",
    },
    {
        "id": "majestic",
        "name": "Majestic / Kempegowda Bus Stand",
        "lat": 12.9779, "lon": 77.5724,
        "area": "Central Bangalore transit hub",
        "peak_hours": "All day",
    },
    {
        "id": "indiranagar",
        "name": "Indiranagar 100ft Road",
        "lat": 12.9784, "lon": 77.6408,
        "area": "CMH Road / HAL Airport Road",
        "peak_hours": "8–10 AM, 6–9 PM",
    },
]


def get_tomtom_flow(lat: float, lon: float) -> dict:
    """Fetch real-live TomTom speed and congestion for a coordinate."""
    if not TOMTOM_API_KEY:
        return {"speed": None, "freeFlowSpeed": None, "confidence": None}
    try:
        params = {
            "point": f"{lat},{lon}",
            "unit": "KMPH",
            "key": TOMTOM_API_KEY,
        }
        resp = requests.get(TOMTOM_FLOW_URL, params=params, timeout=5)
        if resp.status_code == 200:
            fd = resp.json().get("flowSegmentData", {})
            return {
                "speed": fd.get("currentSpeed"),
                "freeFlowSpeed": fd.get("freeFlowSpeed"),
                "confidence": fd.get("confidence"),
            }
    except Exception as e:
        print(f"TomTom flow error for ({lat},{lon}): {e}")
    return {"speed": None, "freeFlowSpeed": None, "confidence": None}


def derive_congestion(flow: dict) -> dict:
    """Convert TomTom speed data into a congestion index and estimated vehicle count."""
    speed = flow.get("speed")
    free_speed = flow.get("freeFlowSpeed")

    if speed is not None and free_speed and free_speed > 0:
        ratio = speed / free_speed  # 1.0 = free flow, 0 = gridlock
        congestion_pct = round((1 - ratio) * 100, 1)
        # Estimate vehicle count from density: free-flow KMPH ~10 vehicles, gridlock ~120
        vehicle_estimate = int(10 + (1 - ratio) * 110)
        level = (
            "Critical" if congestion_pct >= 80 else
            "High" if congestion_pct >= 60 else
            "Medium" if congestion_pct >= 35 else
            "Low"
        )
        return {
            "congestion_pct": congestion_pct,
            "vehicle_estimate": vehicle_estimate,
            "level": level,
            "current_speed_kmph": speed,
            "free_flow_speed_kmph": free_speed,
        }

    # Fallback realistic defaults based on Bangalore averages
    avg_speed = 18  # Bangalore average during peak
    free_speed_fb = 50
    ratio = avg_speed / free_speed_fb
    congestion_pct = round((1 - ratio) * 100, 1)
    return {
        "congestion_pct": congestion_pct,
        "vehicle_estimate": 70,
        "level": "High",
        "current_speed_kmph": avg_speed,
        "free_flow_speed_kmph": free_speed_fb,
    }


def get_recommendations(congestion_level: str, zone_name: str) -> list[str]:
    """Generate realistic traffic control recommendations based on congestion level."""
    if congestion_level == "Critical":
        return [
            f"Activate emergency signal override at {zone_name}",
            "Extend green phases on primary arterial by 45s",
            "Dispatch traffic police for manual control",
            "Activate alternate route diversion via BMTC corridor",
        ]
    elif congestion_level == "High":
        return [
            "Increase green signal duration by 20–30s on dominant lane",
            "Enable adaptive phase cycling every 60s",
            f"Alert commuters: heavy congestion at {zone_name}",
        ]
    elif congestion_level == "Medium":
        return [
            "Apply standard AI signal optimization",
            "Monitor queue length every 30s via YOLO sensor",
        ]
    else:
        return [
            "System operating normally",
            "Continue baseline 30s signal cycle",
        ]


@router.get("/api/bangalore/traffic")
def get_bangalore_traffic():
    """
    Returns live congestion data for major Bangalore traffic junctions.
    Fetches from TomTom Traffic Flow API when API key is set;
    falls back to calibrated Bangalore averages otherwise.
    """
    results = []
    for zone in BANGALORE_ZONES:
        flow = get_tomtom_flow(zone["lat"], zone["lon"])
        congestion = derive_congestion(flow)
        recommendations = get_recommendations(congestion["level"], zone["name"])
        results.append({
            "id": zone["id"],
            "name": zone["name"],
            "area": zone["area"],
            "peak_hours": zone["peak_hours"],
            "lat": zone["lat"],
            "lon": zone["lon"],
            "congestion_pct": congestion["congestion_pct"],
            "vehicle_estimate": congestion["vehicle_estimate"],
            "level": congestion["level"],
            "current_speed_kmph": congestion["current_speed_kmph"],
            "free_flow_speed_kmph": congestion["free_flow_speed_kmph"],
            "recommendations": recommendations,
            "data_source": "TomTom Traffic Flow API" if flow.get("speed") else "Calibrated Bangalore Average",
        })
    return {"zones": results, "city": "Bangalore, Karnataka", "count": len(results)}
