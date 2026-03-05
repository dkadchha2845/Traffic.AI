from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from auth import get_current_user_id
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TrafficAI Backend API")

# Configure CORS so the React frontend can talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "TrafficAI Backend API is running."}

@app.get("/api/me")
def get_my_profile(user_id: str = Depends(get_current_user_id)):
    """
    A protected endpoint. Only accessible if a valid Supabase JWT is provided.
    """
    return {
        "message": f"Hello User {user_id}! You are authenticated.",
        "user_id": user_id
    }

from agent import get_rag_response

@app.post("/api/rag/chat")
def rag_chat(query: str, user_id: str = Depends(get_current_user_id)):
    """
    RAG Agent endpoint.
    Takes the user query, searches Supabase for real-life traffic scenarios, and generates a response.
    Requires user to be logged in.
    """
    response = get_rag_response(query, user_id)
    return {
        "user_id": user_id,
        "query": query,
        "response": response
    }

import asyncio
import json
import random
import os
from fastapi.responses import StreamingResponse
from vision import TrafficVisionTracker

# Initialize the YOLOv8 vision tracker
video_source = "sample_traffic.mp4" if os.path.exists("sample_traffic.mp4") else 0
vision_tracker = TrafficVisionTracker(source=video_source)

@app.on_event("startup")
def startup_event():
    vision_tracker.start_tracking()

@app.on_event("shutdown")
def shutdown_event():
    vision_tracker.stop_tracking()

async def telemetry_generator():
    """Generates continuous realistic telemetry metrics for the frontend SSE stream."""
    local_cpu = 24.0
    local_memory = 72.0
    from rl_model import predict_action

    while True:
        # Get real vehicle density from the live computer vision module
        vision_metrics = vision_tracker.get_latest_metrics()
        real_density = vision_metrics["density_percentage"]
        vehicle_count = vision_metrics["vehicle_count"]

        # Simulate lane queue distribution based on the total YOLO vehicle count
        # In a fully rigged intersection, this would be 4 distinct camera ROI counts
        base_queue = vehicle_count // 4
        lanes = [
            base_queue + random.randint(0, 3), # North
            base_queue + random.randint(0, 3), # South
            base_queue + random.randint(0, 2), # East
            base_queue + random.randint(0, 2)  # West
        ]
        
        # PPO Agent actively decides the optimal traffic physical light
        rl_action = predict_action(lanes)
        signal_state = "NS_GREEN" if rl_action == 0 else "EW_GREEN"

        # Simulate realistic fluctuations for Hardware metrics
        local_cpu = max(10.0, min(90.0, local_cpu + (random.random() - 0.5) * 10))
        local_memory = max(30.0, min(95.0, local_memory + (random.random() - 0.5) * 6))
        
        payload = {
            "type": "telemetry",
            "cpu_load": round(local_cpu, 1),
            "memory_usage": round(local_memory, 1),
            "network_latency": round(8.0 + random.random() * 10, 1),
            "active_nodes": int(1000 + random.random() * 300),
            "density": round(real_density, 1),
            "vehicle_count": vehicle_count,
            "signal_phase": signal_state,   # Integrated RL AI Controller
            "ns_queue": lanes[0] + lanes[1],
            "ew_queue": lanes[2] + lanes[3]
        }
        
        yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(2) # Stream new telemetry every 2 seconds

@app.get("/api/stream/telemetry")
async def stream_telemetry():
    """
    Server-Sent Events (SSE) endpoint providing live traffic operational metrics.
    Replaces the frontend setInterval mocks.
    """
    return StreamingResponse(telemetry_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
