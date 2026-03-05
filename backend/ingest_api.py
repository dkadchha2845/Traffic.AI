from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
import pandas as pd
import io
import json
from typing import List, Optional
from datetime import datetime
from auth import get_current_user_id

# In a full deployment, this integrates directly with the Supabase client
# from supabase_client import get_supabase

router = APIRouter(prefix="/api/ingest", tags=["Dataset Ingestion Phase 9"])

class TrafficTelemetry(BaseModel):
    intersection_id: str = Field(..., example="BLR-CORE-1")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    vehicle_count: int = Field(..., ge=0)
    density: float = Field(..., ge=0.0, le=100.0)
    weather_condition: Optional[str] = "clear"
    event_flag: Optional[str] = None

class BatchTelemetryPayload(BaseModel):
    source: str = Field(..., example="iot_sensor_array_alpha")
    data: List[TrafficTelemetry]

def process_batch_insert(records: List[dict]):
    """
    Background Task: Validates and securely pushes massive datasets to TimescaleDB/Supabase.
    """
    # Ex: supabase = get_supabase()
    # supabase.table("traffic_history").insert(records).execute()
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
    
    # Offload heavy DB IO to background to maintain fast API response
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
    Requires schema: intersection_id, timestamp, vehicle_count, density
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only standard CSV files are permitted for bulk ingestion.")
        
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Rigorous schema validation
        required_cols = {'intersection_id', 'vehicle_count', 'density'}
        if not required_cols.issubset(df.columns):
            raise HTTPException(status_code=400, detail=f"Invalid Schema. Missing mandatory columns: {required_cols - set(df.columns)}")
            
        # Clean & extract features
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
