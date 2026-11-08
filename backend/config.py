import os
from pathlib import Path

from dotenv import dotenv_values

BASE_DIR = Path(__file__).resolve().parent

# A variável do processo sempre tem precedência. Sem ela, o ambiente é lido
# do arquivo apropriado antes que as demais configurações sejam carregadas.
_process_environment = os.getenv("APP_ENV")
_default_values = dotenv_values(BASE_DIR / ".env")
APP_ENV = (
    _process_environment
    or _default_values.get("APP_ENV")
    or "development"
).strip().lower()
if APP_ENV not in {"development", "testing", "production"}:
    raise RuntimeError(
        "APP_ENV deve ser development, testing ou production."
    )

ENV_FILE = BASE_DIR / (".env.test" if APP_ENV == "testing" else ".env")
if not ENV_FILE.exists() and APP_ENV == "testing":
    ENV_FILE = BASE_DIR / ".env"
for _key, _value in dotenv_values(ENV_FILE).items():
    if _value is not None:
        os.environ.setdefault(_key, _value)


class Config:
    """Configuração única do backend WEPAY."""

    ENVIRONMENT = APP_ENV

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "wepay_db")
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
    if not 1 <= DB_POOL_SIZE <= 32:
        raise RuntimeError("DB_POOL_SIZE deve estar entre 1 e 32.")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    if ENVIRONMENT == "production" and (
        len(SECRET_KEY) < 32
        or SECRET_KEY in {
            "troque-por-uma-chave-segura-e-unica",
            "development-only-change-this-secret",
        }
    ):
        raise RuntimeError(
            "SECRET_KEY deve ter ao menos 32 caracteres aleatórios em produção."
        )
    if not SECRET_KEY:
        SECRET_KEY = "development-only-change-this-secret"

    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRES_MINUTES = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60")
    )
    JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(
        os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")
    )

    _rate_limit_storage_uri = os.getenv("RATE_LIMIT_STORAGE_URI", "").strip()
    if ENVIRONMENT == "production" and not _rate_limit_storage_uri:
        raise RuntimeError(
            "RATE_LIMIT_STORAGE_URI deve ser configurado com storage compartilhado em produção."
        )
    RATE_LIMIT_STORAGE_URI = _rate_limit_storage_uri or "memory://"
    RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5 per minute")
    RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "10 per hour")
    RATE_LIMIT_PASSWORD_RESET_REQUEST = os.getenv(
        "RATE_LIMIT_PASSWORD_RESET_REQUEST", "5 per hour"
    )
    RATE_LIMIT_PASSWORD_RESET_CONFIRM = os.getenv(
        "RATE_LIMIT_PASSWORD_RESET_CONFIRM", "10 per hour"
    )
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]
    AUTH_REFRESH_COOKIE_NAME = os.getenv(
        "AUTH_REFRESH_COOKIE_NAME", "wepay_refresh"
    )
    AUTH_REFRESH_COOKIE_SAMESITE = os.getenv(
        "AUTH_REFRESH_COOKIE_SAMESITE", "Lax"
    ).capitalize()
    if AUTH_REFRESH_COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
        raise RuntimeError(
            "AUTH_REFRESH_COOKIE_SAMESITE deve ser Lax, Strict ou None."
        )
    AUTH_REFRESH_COOKIE_SECURE = (
        os.getenv("AUTH_REFRESH_COOKIE_SECURE", "").lower() == "true"
        or ENVIRONMENT == "production"
    )
    if AUTH_REFRESH_COOKIE_SAMESITE == "None" and not AUTH_REFRESH_COOKIE_SECURE:
        raise RuntimeError(
            "Cookies SameSite=None exigem AUTH_REFRESH_COOKIE_SECURE=true."
        )

    EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "")
    EMAIL_SENHA_APP = os.getenv("EMAIL_SENHA_APP", "")
    EMAIL_SERVER = os.getenv("EMAIL_SERVER", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "465"))
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")
    ALLOW_EMAIL_TEST = os.getenv("ALLOW_EMAIL_TEST", "false").lower() == "true"

    if ENVIRONMENT == "production" and (
        not FRONTEND_URL.startswith("https://")
        or not CORS_ORIGINS
        or any(not origin.startswith("https://") for origin in CORS_ORIGINS)
    ):
        raise RuntimeError(
            "FRONTEND_URL e todas as origens CORS devem usar HTTPS em produção."
        )

    if ENVIRONMENT == "production" and RATE_LIMIT_STORAGE_URI.lower().startswith("memory://"):
        raise RuntimeError(
            "RATE_LIMIT_STORAGE_URI deve usar storage compartilhado em produção."
        )

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN", "")
