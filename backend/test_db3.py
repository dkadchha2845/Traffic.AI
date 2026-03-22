import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(env_path)
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

from supabase.client import create_client
supabase = create_client(url, key)

print("Trying row 1: with intersection_id=None")
try:
    res = supabase.table("signal_logs").insert([{"agent_name": "Test1", "action": "A", "message": "M", "intersection_id": None}]).execute()
    print("Success:", res.data)
except Exception as e:
    print("Fail 1:", e)

print("Trying row 2: with dummy UUID user_id")
try:
    res = supabase.table("signal_logs").insert([{"agent_name": "Test2", "action": "A", "message": "M", "user_id": "00000000-0000-0000-0000-000000000000"}]).execute()
    print("Success:", res.data)
except Exception as e:
    print("Fail 2:", e)
