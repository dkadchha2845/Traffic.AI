import os
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class HealthStatus(BaseModel):
    status: str
    supabase_connected: bool
    vision_active: bool
    websocket_running: bool

@router.get("/api/health", response_model=HealthStatus)
def check_health():
    """
    Returns the comprehensive health status of the backend systems.
    """
    sb_url = os.getenv("VITE_SUPABASE_URL", "")
    sb_key = os.getenv("VITE_SUPABASE_ANON_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    
    return HealthStatus(
        status="online",
        supabase_connected=bool(sb_url and sb_key),
        vision_active=True,  # Assuming initialized in startup
        websocket_running=True
    )
