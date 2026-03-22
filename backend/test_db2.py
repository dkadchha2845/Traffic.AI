import os
import sys
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(env_path)
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

from supabase.client import create_client
supabase = create_client(url, key)

print("Fetching latest logs...")
res = supabase.table("signal_logs").select("*").limit(5).execute()
print(res)

boot_logs = [
    {"agent_name": "SystemBoot", "action": "Startup", "message": "TrafficAI backend started. All subsystems initializing.", "log_type": "INFO"},
    {"agent_name": "TomTomAPI", "action": "Connection", "message": f"TomTom live traffic feed connected. Grid nodes active: 9", "log_type": "SUCCESS"},
    {"agent_name": "VisionEngine", "action": "Status", "message": f"Computer vision state: active. Configured cameras: 0", "log_type": "INFO"},
    {"agent_name": "RLModel", "action": "Status", "message": f"PPO RL model: loaded", "log_type": "INFO"},
    {"agent_name": "SupabaseDB", "action": "Connection", "message": "Supabase Postgres connection established. Telemetry persistence active.", "log_type": "SUCCESS"},
]
try:
    print("Trying to insert boot_logs...")
    res = supabase.table("signal_logs").insert(boot_logs).execute()
    print("Success! Data:", res.data)
except Exception as e:
    print("FAILED with Exception:", type(e), str(e))
