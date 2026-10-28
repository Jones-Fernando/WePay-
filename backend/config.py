import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuração única do backend WEPAY."""

    ENVIRONMENT = os.getenv("APP_ENV", "development").lower()

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "wepay_db")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    if not SECRET_KEY:
        if ENVIRONMENT == "production":
            raise RuntimeError("SECRET_KEY deve ser definida em produção.")
        SECRET_KEY = "development-only-change-this-secret"

    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRES_MINUTES = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60")
    )
    JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(
        os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")
    )

    RATE_LIMIT_STORAGE_URI = os.getenv("RATE_LIMIT_STORAGE_URI", "memory://")
    RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5 per minute")
    RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "10 per hour")

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]

    EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "")
    EMAIL_SENHA_APP = os.getenv("EMAIL_SENHA_APP", "")
    EMAIL_SERVER = os.getenv("EMAIL_SERVER", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "465"))
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")
    APP_DEEP_LINK_URL = os.getenv("APP_DEEP_LINK_URL", "wepay://")
    ALLOW_EMAIL_TEST = os.getenv("ALLOW_EMAIL_TEST", "false").lower() == "true"

    if ENVIRONMENT == "production" and RATE_LIMIT_STORAGE_URI == "memory://":
        raise RuntimeError(
            "RATE_LIMIT_STORAGE_URI deve usar storage compartilhado em produção."
        )

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
