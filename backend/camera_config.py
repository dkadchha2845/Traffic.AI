import json
import os
from typing import Any

DEFAULT_CAMERA_CONFIGS: list[dict[str, Any]] = [
    {
        "id": "cam-silk-board",
        "zone_id": "silk-board",
        "name": "Silk Board Junction",
        "area": "BTM Layout Flyover",
        "snapshot_ids": ["silk-board", "BLR-CORE-1"],
        "primary_stream": True,
        "source_env": "CCTV_RTSP_URL_SILK_BOARD",
    },
    {
        "id": "cam-marathahalli",
        "zone_id": "marathahalli",
        "name": "Marathahalli Bridge",
        "area": "Outer Ring Road",
        "snapshot_ids": ["marathahalli"],
        "primary_stream": False,
        "source_env": "CCTV_RTSP_URL_MARATHAHALLI",
    },
    {
        "id": "cam-hebbal",
        "zone_id": "hebbal-flyover",
        "name": "Hebbal Flyover",
        "area": "NH-44 Airport Road",
        "snapshot_ids": ["hebbal-flyover", "hebbal"],
        "primary_stream": False,
        "source_env": "CCTV_RTSP_URL_HEBBAL",
    },
    {
        "id": "cam-ecity",
        "zone_id": "ecity-flyover",
        "name": "Electronic City Flyover",
        "area": "Hosur Road",
        "snapshot_ids": ["ecity-flyover", "ecity"],
        "primary_stream": False,
        "source_env": "CCTV_RTSP_URL_ECITY",
    },
]


def _load_camera_source_overrides() -> dict[str, str]:
    raw = os.getenv("CAMERA_SOURCES_JSON", "").strip()
    if not raw:
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"[camera_config] CAMERA_SOURCES_JSON parse failed: {exc}")
        return {}

    if not isinstance(parsed, dict):
        print("[camera_config] CAMERA_SOURCES_JSON must be a JSON object.")
        return {}

    normalized: dict[str, str] = {}
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str) and value.strip():
            normalized[key] = value.strip()
    return normalized


def get_camera_configs() -> list[dict[str, Any]]:
    source_overrides = _load_camera_source_overrides()
    primary_legacy_source = os.getenv("CCTV_RTSP_URL", "").strip()
    configs: list[dict[str, Any]] = []

    for camera in DEFAULT_CAMERA_CONFIGS:
        source = (
            os.getenv(camera["source_env"], "").strip()
            or source_overrides.get(camera["id"], "").strip()
            or source_overrides.get(camera["zone_id"], "").strip()
        )
        if camera["primary_stream"] and not source and primary_legacy_source:
            source = primary_legacy_source

        frame_endpoint = f"/api/vision/frame/{camera['id']}"
        configs.append({
            **camera,
            "source": source or None,
            "source_configured": bool(source),
            "frame_endpoint": frame_endpoint,
        })

    return configs


def get_camera_config(camera_id: str) -> dict[str, Any] | None:
    for camera in get_camera_configs():
        if camera["id"] == camera_id:
            return camera
    return None


def get_primary_camera_config() -> dict[str, Any]:
    configs = get_camera_configs()
    for camera in configs:
        if camera["primary_stream"]:
            return camera
    return configs[0]
