import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(env_path)
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", "")))

from supabase.client import create_client
import httpx

# Directly fetch from the REST API to get the schema columns using OPTIONS
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
}

r = httpx.options(f"{url}/rest/v1/signal_logs", headers=headers)
print("OPTIONS Status:", r.status_code)

# To get columns, we can just do a select limit 1, or query OpenAPI spec
swagger = httpx.get(f"{url}/rest/v1/", headers=headers).json()
try:
    tables = {}
    for table_name, table_schema in swagger.get('definitions', {}).items():
        if 'properties' in table_schema:
            tables[table_name] = list(table_schema['properties'].keys())
    with open("schema_output.txt", "w") as f:
        f.write(str(tables))
    print("Wrote all tables to schema_output.txt")
except Exception as e:
    print("Could not parse swagger:", e)
