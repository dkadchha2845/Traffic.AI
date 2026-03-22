import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
print("Target .env path:", env_path)
print("Exists:", os.path.exists(env_path))
load_dotenv(env_path)

url = os.getenv("VITE_SUPABASE_URL", "")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))
print("URL:", url)
print("KEY loaded:", bool(key))
if not key:
    print("Cannot find any supabase key!")
    exit(1)

try:
    from supabase.client import create_client
    supabase = create_client(url, key)
    print("Trying to insert into signal_logs...")
    res = supabase.table("signal_logs").insert([{"agent_name": "Test", "action": "Test", "message": "Test"}]).execute()
    print("Insert success:", res)
except Exception as e:
    import builtins
    if hasattr(e, 'message'): print("Message:", e.message)
    if hasattr(e, 'code'): print("Code:", e.code)
    try:
        with open("error_output.txt", "w") as f:
            f.write(str(e.__dict__))
        print("Raw dict written to error_output.txt")
    except:
        print("Raw err:", str(e))
