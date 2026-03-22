import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(env_path)
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

from supabase.client import create_client
supabase = create_client(url, key)

print("Trying to reload schema cache")
try:
    res = supabase.rpc('reload_schema_cache', {}).execute()
    print("Success:", res)
except Exception as e:
    print("Fail:", e)
