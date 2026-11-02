import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

# Automatically discover and load the root global .env file
current_file = Path(__file__).resolve()
# Traverse up to locate root .env: app -> research-python -> project root
for parent in [current_file.parents[3], current_file.parents[2], Path.cwd()]:
    env_candidate = parent / ".env"
    if env_candidate.exists():
        load_dotenv(dotenv_path=env_candidate)
        break
else:
    load_dotenv()

api_key = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY") or ""

# Auto-detect base URL and model based on key prefix
if api_key.startswith("gsk_"):
    default_base_url = "https://api.groq.com/openai/v1"
    default_model = "openai/gpt-oss-120b"
else:
    default_base_url = "https://api.openai.com/v1"
    default_model = "gpt-4o-mini"

class Settings(BaseModel):
    PROJECT_NAME: str = "BTCUSD AI Market Research Engine"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./research.db")
    MARKET_ENGINE_URL: str = os.getenv("MARKET_ENGINE_URL", "http://localhost:8080")
    SYMBOL: str = os.getenv("MARKET_SYMBOL", "BTCUSDT")
    LLM_API_KEY: str = api_key
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", default_base_url)
    LLM_MODEL: str = os.getenv("LLM_MODEL", default_model)

settings = Settings()
