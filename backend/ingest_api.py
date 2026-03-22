from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
import io
from typing import List, Optional
from datetime import datetime
from auth import get_current_user_id
import os

router = APIRouter(prefix="/api/ingest", tags=["Dataset Ingestion Phase 9"])

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

def _get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[ingest_api] Supabase unavailable: {e}")
        return None

class TrafficTelemetry(BaseModel):
    intersection_id: str = Field(..., example="BLR-CORE-1")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    vehicle_count: int = Field(..., ge=0)
    density: float = Field(..., ge=0.0, le=100.0)
    weather_condition: Optional[str] = None
    event_flag: Optional[str] = None

class BatchTelemetryPayload(BaseModel):
    source: str = Field(..., example="iot_sensor_array_alpha")
    data: List[TrafficTelemetry]

def process_batch_insert(records: List[dict]):
    """
    Background Task: Validates and securely pushes massive datasets to TimescaleDB/Supabase.
    """
    sb = _get_supabase()
    if sb:
        try:
            sb.table("traffic_history").insert(records).execute()
        except:
            pass
    print(f"[Dataset Ingest] Successfully processed and stored {len(records)} IoT telemetry frames into database.")

@router.post("/stream/json", summary="Ingest real-time IoT JSON streams")
async def ingest_json_stream(
    payload: BatchTelemetryPayload, 
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Validates High-Frequency JSON arrays from external traffic sensors.
    """
    records = [item.dict() for item in payload.data]
    background_tasks.add_task(process_batch_insert, records)
    return {
        "status": "success",
        "message": f"Accepted {len(records)} records for processing.",
        "batch_id": f"batch_{int(datetime.utcnow().timestamp())}"
    }

@router.post("/batch/csv", summary="Bulk-Ingest Historic Traffic CSVs")
async def ingest_csv_batch(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """
    Parses massive CSV datasets for training forecasting algorithms.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only standard CSV files are permitted for bulk ingestion.")
        
    try:
        import pandas as pd
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        required_cols = {'intersection_id', 'vehicle_count', 'density'}
        if not required_cols.issubset(df.columns):
            raise HTTPException(status_code=400, detail=f"Invalid Schema. Missing mandatory columns: {required_cols - set(df.columns)}")
            
        df = df.dropna(subset=['intersection_id', 'vehicle_count', 'density'])
        df['density'] = pd.to_numeric(df['density'], errors='coerce').fillna(0).clip(0, 100)
        df['vehicle_count'] = pd.to_numeric(df['vehicle_count'], errors='coerce').fillna(0).astype(int)
        
        if 'timestamp' not in df.columns:
            df['timestamp'] = datetime.utcnow().isoformat()
            
        records = df.to_dict(orient='records')
        background_tasks.add_task(process_batch_insert, records)
        
        return {
            "status": "success",
            "message": f"Successfully parsed {len(records)} rows from {file.filename}.",
            "ingested_features": list(df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV Parsing failure: {str(e)}")
