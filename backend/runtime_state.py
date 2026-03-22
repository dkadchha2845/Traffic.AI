import time
from copy import deepcopy
from typing import Any

START_TIME = time.time()

runtime_state: dict[str, Any] = {
    "traffic_api": {"status": "idle", "last_success_at": None, "last_error": None, "source": "unconfigured"},
    "weather_api": {"status": "idle", "last_success_at": None, "last_error": None, "source": "unconfigured"},
    "supabase": {"status": "idle", "last_success_at": None, "last_error": None},
    "vision": {"status": "starting", "last_success_at": None, "last_error": None, "source": "camera"},
    "rl_model": {"status": "unknown", "last_success_at": None, "last_error": None},
    "telemetry": {"status": "starting", "last_success_at": None, "last_error": None, "last_payload_at": None},
    "websocket": {"client_count": 0, "last_connected_at": None, "last_disconnected_at": None},
}


def now_ts() -> float:
    return time.time()


def mark_success(name: str, **extra: Any) -> None:
    entry = runtime_state.setdefault(name, {})
    entry.update(extra)
    entry["status"] = extra.get("status", "live")
    entry["last_success_at"] = now_ts()
    entry["last_error"] = None


def mark_error(name: str, error: Exception | str, status: str = "degraded", **extra: Any) -> None:
    entry = runtime_state.setdefault(name, {})
    entry.update(extra)
    entry["status"] = status
    entry["last_error"] = str(error)


def mark_payload() -> None:
    runtime_state["telemetry"]["last_payload_at"] = now_ts()
    runtime_state["telemetry"]["last_success_at"] = runtime_state["telemetry"]["last_payload_at"]


def set_websocket_client_delta(delta: int) -> None:
    websocket = runtime_state["websocket"]
    websocket["client_count"] = max(0, int(websocket.get("client_count", 0)) + delta)
    if delta > 0:
        websocket["last_connected_at"] = now_ts()
    if delta < 0:
        websocket["last_disconnected_at"] = now_ts()


def get_runtime_snapshot() -> dict[str, Any]:
    snapshot = deepcopy(runtime_state)
    snapshot["uptime_seconds"] = round(now_ts() - START_TIME, 1)
    return snapshot
