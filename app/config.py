from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AssurAuto Pro API"
    debug: str | bool = False
    api_prefix: str = "/api/v1"

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="assurauto", alias="DB_NAME")
    db_user: str = Field(default="", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")

    uploads_dir: Path = Field(default=Path("uploads"), alias="UPLOADS_DIR")
    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")

    mistral_api_key: str | None = Field(default=None, alias="MISTRAL_API_KEY")
    mistral_ocr_model: str = Field(default="mistral-ocr-latest", alias="MISTRAL_OCR_MODEL")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    gemini_vision_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_VISION_MODEL")

    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    @property
    def database_url(self) -> str:
        return URL.create(
            "postgresql+psycopg2",
            username=self.db_user or None,
            password=self.db_password or None,
            host=self.db_host or None,
            port=self.db_port,
            database=self.db_name,
        ).render_as_string(hide_password=False)

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def debug_enabled(self) -> bool:
        if isinstance(self.debug, bool):
            return self.debug
        return self.debug.strip().lower() in {"1", "true", "yes", "on", "debug", "development", "dev"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
