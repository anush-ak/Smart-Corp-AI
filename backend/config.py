import os
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://localhost:5432/smartcorp_db")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
JWT_SECRET: str = os.getenv("JWT_SECRET", "smartcorp_default_secret_key_change_me")
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
ALLOWED_ORIGINS: List[str] = [
    origin.strip() for origin in _allowed_origins_raw.split(",") if origin.strip()
]
