import os
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))

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
    """
    sb = _get_supabase()
    
    if sb:
        try:
            query = sb.table("signal_logs").select("*").order("created_at", desc=True).limit(limit).range(offset, offset + limit - 1)
            
            if level and level != "ALL":
                query = query.eq("log_type", level)
                
            resp = query.execute()
            
            # Count logic (Supabase Python client exact count is slightly complex, using a rough estimate or returning None)
            # In a production app, we would use `.execute(count='exact')` and parse the count.
            
            return {
                "logs": resp.data,
                "total": len(resp.data) if len(resp.data) < limit else 1000 # Placeholder for total pagination size
            }
        except Exception as e:
            print(f"Error fetching audit logs: {e}")
    
    # Graceful fallback data if DB is offline or empty
    return {
        "logs": [
            {
                "id": "demo-1",
                "created_at": "2026-03-06T12:00:00Z",
                "log_type": "INFO", 
                "agent_name": "System Audit",
                "action": "SYSTEM_START",
                "message": "Demo Mode: Traffic Control System Initialized."
            },
            {
                "id": "demo-2",
                "created_at": "2026-03-06T12:05:00Z",
                "log_type": "ALERT", 
                "agent_name": "TrafficVision",
                "action": "CONGESTION_DETECTED",
                "message": "Demo Mode: High congestion detected at Electronic City Flyover."
            }
        ],
        "total": 2
    }
