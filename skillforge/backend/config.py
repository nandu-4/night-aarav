import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_url: str = "mongodb://127.0.0.1:27017"
    mongo_db: str = "skillforge"
    jwt_secret: str = "sf-dev-secret-change-me-7f3a9c1e"
    jwt_hours: int = 12
    # The Talent Nurturing Agent — the source of truth for programs, progress,
    # completion, certification records, HIL decisions and audit history.
    tn_base_url: str = "http://127.0.0.1:8000"
    default_password: str = "learn123"

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"


settings = Settings()
print(f"[SKILLFORGE] Mongo: {settings.mongo_url}/{settings.mongo_db} | TN: {settings.tn_base_url}")
