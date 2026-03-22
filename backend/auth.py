from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# We use the standard React frontend variables to initialize Supabase
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
# We can just use the public ANON key for auth verification
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))

# Initialize the Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

security = HTTPBearer()

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Dependency to verify the Supabase JWT token in the Authorization header.
    It calls Supabase's `get_user` which automatically handles new ECC keys or legacy keys seamlessly!
    """
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user.id
        else:
            raise Exception("User payload empty.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
