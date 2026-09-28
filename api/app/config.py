from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The placeholder values from .env.example. Only acceptable in demo mode.
DEFAULT_SECRETS = {"jwt_secret": "change-me", "email_pepper": "change-me-too"}


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
    demo_mode: bool = False  # compose and .env.example turn it on for the demo

    # Public base URL of this API. The worker uses it to fetch audio over HTTPS
    # when it does not share the API's media volume (GPU box / Colab).
    api_base_url: str = "http://localhost:8000"

    # Comma-separated CORS origins, or "*" for the demo stack.
    cors_origins: str = "*"

    # Display-time zone for day labels ("this evening"). Campus is Central.
    display_timezone: str = "America/Chicago"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def refuse_default_secrets(self) -> "Settings":
        """Refuse to start with the example secrets unless DEMO_MODE is on: JWT_SECRET also signs
        media URLs, so a default one lets anyone forge audio links."""
        if not self.demo_mode:
            unchanged = [
                name.upper() for name, value in DEFAULT_SECRETS.items() if getattr(self, name) == value
            ]
            if unchanged:
                raise ValueError(
                    f"{', '.join(unchanged)} still set to the example value; "
                    "set real secrets or DEMO_MODE=true"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
