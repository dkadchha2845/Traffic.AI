import os
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import Client, create_client
from dotenv import load_dotenv
import json

from traffic_api import get_live_weather, get_live_traffic_congestion, get_historical_traffic_data

load_dotenv()

# Supabase details for vector store
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "your_supabase_url")
# NOTE: To use LangChain with Supabase pgvector securely from a backend,
# it is recommended to use the Service Role Key, NOT the anon key,
# so the backend has full access to the database bypassing RLS.
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "your_service_role_key")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --- MOCK OPENAI INTEGRATION (Bypass Billing) ---
class MockEmbeddings:
    """Generates fake 1536-dimensional vectors to test Supabase pgvector without OpenAI billing."""
    def embed_documents(self, texts):
        return [[0.01] * 1536 for _ in texts]
    def embed_query(self, text):
        return [0.01] * 1536

# Initialize the Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

try:
    print("Initializing VectorStore with MOCK Embeddings...")
    embeddings = MockEmbeddings()
    vector_store = SupabaseVectorStore(
        embedding=embeddings,
        client=supabase,
        table_name="documents",
        query_name="match_documents"
    )
except Exception as e:
    print(f"Warning: Could not initialize VectorStore. Error: {e}")
    vector_store = None

def get_rag_response(query: str, user_id: str) -> str:
    """
    Takes a user query, fetches relevant real-life traffic scenarios from Supabase,
    and uses an LLM to generate an automated response.
    """
    if not vector_store:
        return "System Error: Vector store is not configured or API keys are missing. Please check .env file."
        
    try:
        # 1. Retrieve relevant scenarios from Supabase based on the query
        docs = vector_store.similarity_search(query, k=3)
        context = "\n\n".join([doc.page_content for doc in docs])
        # Fetch Live JSON Parameters
        live_weather = get_live_weather()
        live_traffic = get_live_traffic_congestion()
        historical_stats = get_historical_traffic_data()
        
        live_json_context = json.dumps({
            "current_weather": live_weather,
            "current_congestion": live_traffic,
            "historical_baseline": historical_stats
        }, indent=2)

        # 2. Setup the LLM Prompt (MOCK LLM)
        prompt = f"""
        You are an intelligent Traffic Management Agent. 
        Use the following real-life traffic scenarios from our database and the live system telemetry to formulate your response:
        
        <historical_scenario_context>
        {context}
        </historical_scenario_context>
        
        <live_system_telemetry>
        {live_json_context}
        </live_system_telemetry>

        User Query: {query}
        
        Provide a helpful, automated response integrating the dataset contexts and current telemetry.
        """
        
        # 3. Generate response (MOCK)
        print("[MOCK] Bypassing OpenAI LLM Generation...")
        mock_response = f"[MOCK AGENT INFO] Successfully retrieved similar scenarios from Supabase and live API datasets.\n\nSimulated AI Answer: Based on your query '{query}', the current weather is {live_weather['condition']} at {live_weather['temp']}°C, and live congestion is {live_traffic['congestion_level']}%. Given these real-time JSON parameters, I am adjusting signal timings automatically to optimize flow."
        return mock_response
        
    except Exception as e:
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "429" in error_msg:
            print(f"[ERROR] Quota Exceeded: {error_msg}")
            return "System Error: The AI agent cannot formulate a response because the OpenAI account has insufficient quota or no active billing. Please check your billing dashboard."
            
        print(f"[ERROR] Agent communication failure (Mocking Response Instead): {error_msg}")
        return f"[MOCK AGENT INFO] The backend API endpoint is fully functional, but there is a Database or Keys issue preventing data retrieval: {str(e)[:50]}... Simulated AI Answer: I recommend adjusting the traffic flow by +2 seconds."

# --- Helper Function to Ingest Data ---
def ingest_real_life_scenario(text_content: str, metadata: dict = None):
    """
    Helper function to load a new real-life scenario into the Supabase pgvector database.
    """
    if not vector_store:
        raise ValueError("Vector store not configured.")
        
    try:
        vector_store.add_texts([text_content], metadatas=[metadata] if metadata else None)
        return True
    except Exception as e:
        if "insufficient_quota" in str(e) or "429" in str(e):
            raise Exception("OpenAI Quota Exceeded. The AI agent cannot generate embeddings for ingestion because the OpenAI account lacks active billing.")
        raise e

async def auto_ingest_live_alerts():
    """
    Phase 12: Nightly/Hourly background task to fetch LIVE incidents and embed them into pgvector RAG memory.
    """
    import asyncio
    while True:
        try:
            weather = get_live_weather()
            congestion = get_live_traffic_congestion(12.9716, 77.5946)
            
            # Translate tabular API metrics to natural language blocks for PGVector storage
            w_txt = f"CITY EVENT MEMORY: Current weather recorded as {weather['condition']} at {weather['temp']}C. Wind speed {weather['wind_speed']}m/s."
            t_txt = f"CITY EVENT MEMORY: Core Bangalore Grid congestion spiked to {congestion['congestion_level']}%. Status: {congestion['traffic_flow']}."
            
            ingest_real_life_scenario(w_txt, metadata={"type": "live_weather"})
            ingest_real_life_scenario(t_txt, metadata={"type": "live_traffic"})
            
            await asyncio.sleep(3600) # Only push to semantic embedding space hourly
        except Exception as e:
            await asyncio.sleep(3600)
