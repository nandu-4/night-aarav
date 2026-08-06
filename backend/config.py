from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/postgres"
    groq_api_key: str = ""                # required for AI intake; set in .env
    groq_model: str = "llama-3.3-70b-versatile" # override via GROQ_MODEL
    openai_api_key: str = ""              # legacy — no longer used
    anthropic_api_key: str = ""           # legacy — no longer used
    agentcall_api_key: str = ""           # optional — lets Avathar join Google Meets (agentcall.dev)
    avathar_public_url: str = ""          # public URL of the /avathar page (tunnel/ngrok) for meet mode
    debug: bool=False
    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"

settings = Settings()

# backend/.env wins over machine-wide environment variables for the OpenAI
# settings — otherwise a stale global OPENAI_API_KEY silently overrides the
# key the user pastes into .env.
try:
    from dotenv import dotenv_values
    _file_vals = dotenv_values(os.path.join(os.path.dirname(__file__), ".env"))
    if _file_vals.get("GROQ_API_KEY"):
        settings.groq_api_key = _file_vals["GROQ_API_KEY"]
    if _file_vals.get("GROQ_MODEL"):
        settings.groq_model = _file_vals["GROQ_MODEL"]
except ImportError:
    pass

print(f"[CONFIG] Connecting to: {settings.database_url[:60]}...")
print(f"[CONFIG] AI model: {settings.groq_model} | key: {'set' if settings.groq_api_key else 'NOT SET'}")
