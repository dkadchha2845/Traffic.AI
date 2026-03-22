import os
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

def _get_supabase():
    """Lazily create the Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[audit_api] Supabase unavailable: {e}")
        return None

@router.get("/api/audit/logs")
def get_audit_logs(limit: int = 50, offset: int = 0, level: Optional[str] = None):
    """
    Fetch audit logs from the signal_logs table.
    Returns real database logs or an empty list if DB is offline.
    """
    sb = _get_supabase()

    if sb:
        try:
            query = sb.table("signal_logs").select("*").order("created_at", desc=True).limit(limit).range(offset, offset + limit - 1)

            if level and level != "ALL":
                query = query.eq("impact", level)

            resp = query.execute()

            return {
                "logs": resp.data,
                "total": len(resp.data) if len(resp.data) < limit else 1000
            }
        except Exception as e:
            print(f"Error fetching audit logs: {e}")

    return {"logs": [], "total": 0}
