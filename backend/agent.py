"""
agent.py — TrafficAI Strategic Copilot (RAG Agent)

Combines real OpenAI LLM calls with live traffic telemetry context
and semantic search through the Supabase vector store.

Falls back gracefully if OpenAI key is missing or langchain is unavailable.
"""
import os
import json
import datetime

from traffic_api import get_live_weather, get_live_traffic_congestion


def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

_load_env()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ── Lazy-load heavy dependencies ──────────────────────────────────────────────
_supabase_client = None
_vector_store = None
_openai_client = None

SYSTEM_PROMPT = """You are TrafficAI Strategic Copilot — an expert AI assistant for the Agentic AI-Based Smart Traffic Management System deployed across Bangalore, India.

Your capabilities:
1. Analyze live traffic data from TomTom Flow API and YOLO Vision sensors
2. Provide actionable traffic control recommendations
3. Advise on signal timing, diversion routes, and emergency corridors
4. Explain congestion patterns using historical Bangalore traffic knowledge

Key Bangalore Knowledge:
- Silk Board Junction: Busiest junction in India. Peak hours 7-10 AM, 5-9 PM. Avg peak congestion 85-95%.
- Marathahalli Bridge: ORR bottleneck. Peak congestion 75-85%. Alternate: Varthur Road.
- Hebbal Flyover: NH-44/Airport Road confluence. Peak congestion 80-90%.
- Electronic City Flyover: Hosur Road tech corridor. Peak 8-10 AM, 5-8 PM.
- KR Puram Bridge: Old Madras Road bottleneck. Persistent 70-80% congestion.
- Outer Ring Road: Marathahalli-Sarjapur stretch. Peak congestion 75-85%.
- Rain protocol: Extend yellow phase by 1-2s, reduce speed limits by 15 km/h on flyovers.
- Emergency protocol: Green-wave cascade across 3-5 junctions with 90s inter-junction delay.

Rules:
- ALWAYS ground answers in the live data provided in the context
- NEVER fabricate traffic numbers — use provided live density/speed values
- Suggest specific, implementable actions (e.g., "extend green by 30s on NS axis")
- When asked about a junction, reference live congestion % and vehicle counts
- Be concise and operational — this is a mission-critical traffic control system
"""


def _get_supabase():
    global _supabase_client
    if _supabase_client is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            from supabase.client import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        except Exception as e:
            print(f"[agent] Supabase init failed: {e}")
    return _supabase_client


def _get_openai_client():
    """Lazy-load OpenAI client."""
    global _openai_client
    if _openai_client is None and OPENAI_API_KEY:
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=OPENAI_API_KEY)
        except ImportError:
            print("[agent] openai package not installed. Using fallback mode.")
        except Exception as e:
            print(f"[agent] OpenAI client init failed: {e}")
    return _openai_client


def _get_vector_store():
    global _vector_store
    if _vector_store is None:
        try:
            from langchain_community.vectorstores import SupabaseVectorStore
            sb = _get_supabase()
            if sb and OPENAI_API_KEY:
                try:
                    from langchain_openai import OpenAIEmbeddings
                    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
                except ImportError:
                    # Fallback to mock if langchain_openai not available
                    class MockEmbeddings:
                        def embed_documents(self, texts):
                            return [[0.01] * 1536 for _ in texts]
                        def embed_query(self, text):
                            return [0.01] * 1536
                    embeddings = MockEmbeddings()
                    print("[agent] langchain_openai unavailable, using mock embeddings")

                _vector_store = SupabaseVectorStore(
                    embedding=embeddings,
                    client=sb,
                    table_name="documents",
                    query_name="match_documents"
                )
            elif sb:
                class MockEmbeddings:
                    def embed_documents(self, texts):
                        return [[0.01] * 1536 for _ in texts]
                    def embed_query(self, text):
                        return [0.01] * 1536

                _vector_store = SupabaseVectorStore(
                    embedding=MockEmbeddings(),
                    client=sb,
                    table_name="documents",
                    query_name="match_documents"
                )
        except Exception as e:
            print(f"[agent] VectorStore init failed (non-fatal): {e}")
    return _vector_store


def _build_live_context() -> str:
    """Gather real-time traffic context from all available sources."""
    parts = []

    # Live weather
    weather = get_live_weather()
    if weather.get("available"):
        parts.append(
            f"LIVE WEATHER: {weather['condition']} · {weather['temp']}°C · "
            f"Visibility: {weather.get('visibility', 'unknown')}m"
        )

    # Live traffic from TomTom (Silk Board as primary)
    traffic = get_live_traffic_congestion(12.9176, 77.6238)
    if traffic.get("available"):
        parts.append(
            f"LIVE TRAFFIC (Silk Board): Congestion {traffic['congestion_level']}% · "
            f"Speed: {traffic.get('current_speed', '?')} km/h · "
            f"Free-flow: {traffic.get('free_flow_speed', '?')} km/h · "
            f"Source: {traffic['source']}"
        )

    # Try to get command_state for latest telemetry
    try:
        import command_api
        state = command_api.command_state
        if state.get("last_updated", 0) > 0:
            parts.append(
                f"LIVE TELEMETRY: Density {state.get('density', 0)}% · "
                f"Vehicles: {state.get('vehicle_count', 0)} · "
                f"Signal: {state.get('signal_phase', 'unknown')} · "
                f"NS Queue: {state.get('ns_queue', 0)} · EW Queue: {state.get('ew_queue', 0)} · "
                f"Emergency: {'ACTIVE' if state.get('emergency_active') else 'inactive'} · "
                f"AI: {'paused' if state.get('ai_paused') else 'active'}"
            )
    except Exception:
        pass

    # Try to get live recommendations
    try:
        from recommendation_engine import generate_recommendations
        recs = generate_recommendations()
        if recs:
            critical = [r for r in recs if r["priority"] == "CRITICAL"]
            high = [r for r in recs if r["priority"] == "HIGH"]
            if critical:
                parts.append(f"ACTIVE CRITICAL ALERTS ({len(critical)}): " +
                           " | ".join([r["title"] for r in critical[:3]]))
            if high:
                parts.append(f"ACTIVE HIGH ALERTS ({len(high)}): " +
                           " | ".join([r["title"] for r in high[:3]]))
    except Exception:
        pass

    # Time context
    now = datetime.datetime.now()
    hour = now.hour
    is_peak = (7 <= hour <= 10) or (17 <= hour <= 21)
    parts.append(
        f"CURRENT TIME: {now.strftime('%H:%M')} IST · "
        f"{'PEAK HOURS ACTIVE' if is_peak else 'Off-peak period'}"
    )

    return "\n".join(parts) if parts else "No live telemetry currently available."


def get_rag_response(query: str, user_id: str) -> str:
    """
    RAG agent: retrieves vector-store context + live telemetry and generates
    a response using OpenAI GPT-4. Falls back to context-rich template if
    OpenAI is unavailable.
    """
    # 1. Gather live context
    live_context = _build_live_context()

    # 2. Try RAG vector search
    rag_context = ""
    vs = _get_vector_store()
    if vs:
        try:
            docs = vs.similarity_search(query, k=3)
            rag_context = "\n".join([d.page_content for d in docs])
        except Exception as e:
            print(f"[agent] Vector search failed: {e}")

    if not rag_context:
        rag_context = (
            "Historical Bangalore traffic data:\n"
            "- Silk Board peak hour (8AM–10AM): avg congestion 88%\n"
            "- Hebbal Flyover (5PM–8PM): avg congestion 82%\n"
            "- Marathahalli Bridge: avg congestion 76%\n"
            "- Electronic City Flyover: avg congestion 71%\n"
            "- KR Puram Bridge: avg congestion 74%\n"
            "- Outer Ring Road (Sarjapur stretch): avg congestion 72%\n"
            "- Rain impact: +15-25% congestion across all corridors\n"
            "- Emergency protocol: Green-wave 3-5 junctions, 90s cascade"
        )

    # 3. Try OpenAI LLM
    client = _get_openai_client()
    if client:
        try:
            user_message = (
                f"OPERATOR QUERY: {query}\n\n"
                f"--- LIVE OPERATIONAL STATE ---\n{live_context}\n\n"
                f"--- KNOWLEDGE BASE (RAG) ---\n{rag_context[:1500]}"
            )

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=600,
                temperature=0.3,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[agent] OpenAI call failed: {e}")

    # 4. Fallback: structured template response
    live_weather = get_live_weather()
    live_traffic = get_live_traffic_congestion()

    density = live_traffic.get("congestion_level", "?")
    speed = live_traffic.get("current_speed", "?")
    condition = live_weather.get("condition", "unavailable")
    temp = live_weather.get("temp", "?")

    # Generate contextual fallback
    if isinstance(density, (int, float)):
        if density >= 80:
            action = "Activate emergency signal override. Extend green by 45s on dominant axis. Deploy traffic police for manual control."
            level = "CRITICAL"
        elif density >= 60:
            action = "Extend green phase by 20-30s. Enable adaptive cycling every 60s. Alert commuters via BMTC."
            level = "HIGH"
        elif density >= 40:
            action = "Apply standard AI signal optimization. Monitor queue lengths via YOLO sensor every 30s."
            level = "MEDIUM"
        else:
            action = "System operating normally. Maintain baseline 30s signal cycle."
            level = "LOW"
    else:
        action = "Live telemetry unavailable. Maintain manual control protocols."
        level = "UNKNOWN"

    response = (
        f"**TrafficAI Copilot** — {level} Alert\n\n"
        f"**Query**: {query}\n\n"
        f"**Live Status**: {condition} · {temp}°C · "
        f"Congestion: {density}% · Speed: {speed} km/h "
        f"({live_traffic.get('source', 'Unknown')})\n\n"
        f"**Recommendation**: {action}\n\n"
        f"*Note: OpenAI integration unavailable. "
        f"Set OPENAI_API_KEY in .env for advanced GPT-4 powered analysis.*"
    )
    return response


def ingest_real_life_scenario(text_content: str, metadata: dict = None):
    vs = _get_vector_store()
    if not vs:
        raise ValueError("Vector store not available.")
    vs.add_texts([text_content], metadatas=[metadata] if metadata else None)
    return True


async def auto_ingest_live_alerts():
    import asyncio
    while True:
        try:
            weather = get_live_weather()
            congestion = get_live_traffic_congestion()
            w_txt = f"Weather event: {weather['condition']} at {weather['temp']}C."
            t_txt = f"Congestion spike: {congestion['congestion_level']}% on Bangalore grid."
            ingest_real_life_scenario(w_txt, {"type": "live_weather"})
            ingest_real_life_scenario(t_txt, {"type": "live_traffic"})
        except Exception:
            pass
        await asyncio.sleep(3600)
