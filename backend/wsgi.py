from config import Config
from app import create_app
from utils.trusted_proxy import TrustedProxyFix

if Config.ENVIRONMENT != "production":
    raise RuntimeError("WSGI requer APP_ENV=production.")

app = create_app()
if Config.TRUSTED_PROXY_HOPS:
    app.wsgi_app = TrustedProxyFix(
        app.wsgi_app,
        trusted_hops=Config.TRUSTED_PROXY_HOPS,
        trusted_proxy_cidrs=Config.TRUSTED_PROXY_CIDRS,
    )
