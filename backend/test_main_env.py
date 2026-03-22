import sys
import os

from main import SUPABASE_URL, SUPABASE_KEY, supabase

print("Resolved URL:", SUPABASE_URL)
print("Resolved KEY exists:", bool(SUPABASE_KEY))
print("Supabase client created:", supabase is not None)
