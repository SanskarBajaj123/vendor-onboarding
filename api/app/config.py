from functools import lru_cache
from typing import Any, Tuple, Type

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        **kwargs: Any,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        # .env file takes precedence over system environment variables so that
        # project-specific values aren't shadowed by globally-set env vars from
        # other projects on the same machine.
        return (init_settings, dotenv_settings, env_settings)

    supabase_url: str
    supabase_service_role_key: str

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-preview-05-20"
    xai_api_key: str = ""

    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"

    frontend_url: str = "http://localhost:5173"
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
