from typing import Any


def persist_system_telemetry(supabase_client: Any, metrics: dict[str, Any], snapshot: dict[str, Any] | list[dict[str, Any]] | None) -> None:
    if not supabase_client:
        return

    try:
        supabase_client.table("system_metrics").insert(metrics).execute()
        if snapshot:
            supabase_client.table("intersection_snapshots").insert(snapshot).execute()
    except Exception as e:
        print(f"[Telemetry] Supabase insert failed: {e}")
