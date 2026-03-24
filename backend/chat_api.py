from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ChatRequest(BaseModel):
    # Support both old formats for seamless backward compatibility
    message: Optional[str] = None
    query: Optional[str] = None
    junction_id: Optional[str] = "silk-board"
    user_id: Optional[str] = "anonymous"
    mode: Optional[str] = "auto" # "rag" vs "live_context"

class ChatResponse(BaseModel):
    query: str
    response: str
    live_density: Optional[float] = None
    vehicle_count: Optional[int] = None
    signal_phase: Optional[str] = None
    live_context: Optional[str] = None
    timestamp: Optional[str] = None

@router.post("/api/chat", response_model=ChatResponse)
def unified_chat(req: ChatRequest):
    """
    Unified AI Chat Endpoint.
    Routes to either the junction-specific live context (Agents page)
    or the TrafficAI Strategic Copilot (Dashboard / general queries).
    """
    actual_query = req.query or req.message or ""
    
    # If it came from Agents.tsx, it tends to use "message" and wants junction-specific live context.
    if req.message and not req.query:
        from simulation_api import build_live_chat_response

        sim_resp = build_live_chat_response(actual_query, req.junction_id or "silk-board")
        return ChatResponse(
            query=actual_query,
            response=sim_resp.get("response", ""),
            live_context=sim_resp.get("live_context", ""),
            timestamp=sim_resp.get("timestamp", ""),
        )
    
    # Otherwise, use the TrafficAI Strategic Copilot (RAG + OpenAI)
    try:
        from agent import get_rag_response
        response_text = get_rag_response(actual_query, req.user_id or "anonymous")

        # Attach live telemetry metadata
        from command_api import command_state
        live_density = command_state.get("density", 0.0)
        vehicle_count = command_state.get("vehicle_count", 0)
        signal_phase = command_state.get("signal_phase", "NS_GREEN")

        # Also build a compact live_context string for the frontend
        live_parts = []
        if live_density:
            live_parts.append(f"Density: {live_density}%")
        if vehicle_count:
            live_parts.append(f"Vehicles: {vehicle_count}")
        if signal_phase:
            live_parts.append(f"Signal: {signal_phase}")

        return ChatResponse(
            query=actual_query,
            response=response_text,
            live_density=live_density,
            vehicle_count=vehicle_count,
            signal_phase=signal_phase,
            live_context=" · ".join(live_parts) if live_parts else None,
        )
    except Exception as e:
        from traffic_api import get_live_traffic_congestion, get_live_weather
        live = get_live_traffic_congestion(12.9176, 77.6238)
        weather = get_live_weather(12.9716, 77.5946)
        live_density = live.get("congestion_level")
        weather_condition = weather.get("condition") or "unavailable"
        weather_temp = weather.get("temp")
        weather_text = f"{weather_condition} {weather_temp}°C" if weather_temp is not None else weather_condition
        fallback_msg = (
            f"**TrafficAI Copilot** — Fallback Mode\n\n"
            f"Live Bangalore congestion: "
            f"{f'{live_density}%' if live_density is not None else 'unavailable'} "
            f"({live['source']}). Weather: {weather_text}.\n\n"
            f"Query: '{actual_query}'\n\n"
            f"The full AI model is temporarily unavailable ({str(e)[:60]}). "
            f"Please use the live dashboard telemetry and operator runbooks."
        )
        return ChatResponse(
            query=actual_query,
            response=fallback_msg,
            live_density=live_density
        )
