from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings. Mirrors the values in .env.example."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://speakez:speakez@db:5432/speakez"
    redis_url: str = "redis://redis:6379/0"
    storage_backend: str = "local"
    media_dir: str = "/app/media"
    jwt_secret: str = "change-me"
    email_pepper: str = "change-me-too"
    allowed_email_domain: str = "umn.edu"
    resend_api_key: str = ""
    unlock_radius_m: int = 150
    demo_mode: bool = True

    # Display-time zone for day labels ("this evening"). Campus is Central.
    display_timezone: str = "America/Chicago"


@lru_cache
def get_settings() -> Settings:
    return Settings()
