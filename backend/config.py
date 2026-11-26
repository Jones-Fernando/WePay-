import base64
import hashlib
import hmac
import os
from pathlib import Path
from urllib.parse import urlsplit

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


def _validate_production_database_credentials(user: str, password: str) -> None:
    if not user.strip() or user.strip().lower() == "root":
        raise RuntimeError(
            "DB_USER deve ser uma conta dedicada e com privilégios mínimos em produção."
        )
    if not password.strip():
        raise RuntimeError(
            "DB_PASSWORD deve ser configurada para o banco em produção."
        )


def _validate_production_database_tls(ca_path: str) -> str:
    if not ca_path.strip():
        raise RuntimeError(
            "DB_SSL_CA deve apontar para o certificado CA do MySQL em produção."
        )
    if not Path(ca_path).is_file():
        raise RuntimeError(
            "DB_SSL_CA deve apontar para um arquivo CA existente em produção."
        )
    return ca_path


def _validate_database_name_for_environment(
    environment: str,
    database_name: str,
) -> None:
    if (
        environment != "testing"
        and database_name.strip().lower() == "wepay_test"
    ):
        raise RuntimeError(
            "DB_NAME=wepay_test é reservado aos testes do backend."
        )


def _validate_password_reset_url(environment: str, reset_url: str) -> None:
    if not reset_url or environment != "production":
        return

    try:
        parsed_url = urlsplit(reset_url)
        has_no_embedded_credentials = (
            not parsed_url.username and not parsed_url.password
        )
        is_secure_web_url = (
            parsed_url.scheme == "https"
            and bool(parsed_url.hostname)
            and has_no_embedded_credentials
            and not parsed_url.query
            and not parsed_url.fragment
        )
        is_app_deep_link = (
            parsed_url.scheme == "wepay"
            and parsed_url.netloc == "redefinir-senha"
            and not parsed_url.path
            and not parsed_url.query
            and not parsed_url.fragment
        )
    except ValueError:
        is_secure_web_url = False
        is_app_deep_link = False

    if not is_secure_web_url and not is_app_deep_link:
        raise RuntimeError(
            "PASSWORD_RESET_URL em produção deve usar HTTPS ou "
            "wepay://redefinir-senha."
        )


def _parse_cors_origins(value: str | None, environment: str) -> list[str]:
    configured_origins = [
        origin.strip()
        for origin in (value or "").split(",")
        if origin.strip()
    ]
    if environment == "development":
        configured_origins.extend(
            ["http://localhost:8081", "http://127.0.0.1:8081"]
        )
    if not configured_origins:
        configured_origins = [
            "http://localhost:8081",
            "http://127.0.0.1:8081",
        ]
    return list(dict.fromkeys(configured_origins))


class Config:
    """Configuração única do backend WEPAY."""

    ENVIRONMENT = APP_ENV

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "wepay_db")
    _validate_database_name_for_environment(ENVIRONMENT, DB_NAME)
    DB_SSL_CA = os.getenv("DB_SSL_CA", "").strip()
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
    if ENVIRONMENT == "production":
        _validate_production_database_credentials(DB_USER, DB_PASSWORD)
        DB_SSL_CA = _validate_production_database_tls(DB_SSL_CA)

    EMAIL_OUTBOX_ENCRYPTION_KEY = os.getenv(
        "EMAIL_OUTBOX_ENCRYPTION_KEY", ""
    ).strip()
    if ENVIRONMENT == "production" and not EMAIL_OUTBOX_ENCRYPTION_KEY:
        raise RuntimeError(
            "EMAIL_OUTBOX_ENCRYPTION_KEY deve ser configurada em produção."
        )
    if not EMAIL_OUTBOX_ENCRYPTION_KEY:
        EMAIL_OUTBOX_ENCRYPTION_KEY = base64.urlsafe_b64encode(
            hmac.new(
                SECRET_KEY.encode("utf-8"),
                b"wepay-password-reset-outbox-v1",
                hashlib.sha256,
            ).digest()
        ).decode("ascii")

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
    RATE_LIMIT_REFRESH = os.getenv("RATE_LIMIT_REFRESH", "10 per minute")
    RATE_LIMIT_RECEIPT_HOURLY = os.getenv(
        "RATE_LIMIT_RECEIPT_HOURLY", "5 per hour"
    )
    RATE_LIMIT_RECEIPT_DAILY = os.getenv(
        "RATE_LIMIT_RECEIPT_DAILY", "20 per day"
    )
    try:
        TRUSTED_PROXY_HOPS = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))
    except ValueError as exc:
        raise RuntimeError("TRUSTED_PROXY_HOPS deve ser um inteiro.") from exc
    if not 0 <= TRUSTED_PROXY_HOPS <= 10:
        raise RuntimeError("TRUSTED_PROXY_HOPS deve estar entre 0 e 10.")
    TRUSTED_PROXY_CIDRS = tuple(
        cidr.strip()
        for cidr in os.getenv("TRUSTED_PROXY_CIDRS", "").split(",")
        if cidr.strip()
    )
    if TRUSTED_PROXY_HOPS and not TRUSTED_PROXY_CIDRS:
        raise RuntimeError(
            "TRUSTED_PROXY_CIDRS deve identificar o proxy reverso confiável "
            "quando TRUSTED_PROXY_HOPS for maior que zero."
        )
    GEMINI_DAILY_ALERT_REQUESTS = int(
        os.getenv("GEMINI_DAILY_ALERT_REQUESTS", "500")
    )
    if GEMINI_DAILY_ALERT_REQUESTS < 1:
        raise RuntimeError("GEMINI_DAILY_ALERT_REQUESTS deve ser maior que zero.")
    CORS_ORIGINS = _parse_cors_origins(
        os.getenv("CORS_ORIGINS"),
        ENVIRONMENT,
    )
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
    PASSWORD_RESET_URL = os.getenv("PASSWORD_RESET_URL", "").strip()
    _validate_password_reset_url(ENVIRONMENT, PASSWORD_RESET_URL)
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
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    GEMINI_FALLBACK_MODEL = os.getenv(
        "GEMINI_FALLBACK_MODEL",
        "gemini-3.6-flash",
    )
    EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN", "")
