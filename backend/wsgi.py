from app import create_app
from config import Config
from utils.trusted_proxy import TrustedProxyFix

app = create_app()
if Config.TRUSTED_PROXY_HOPS:
    app.wsgi_app = TrustedProxyFix(
        app.wsgi_app,
        trusted_hops=Config.TRUSTED_PROXY_HOPS,
        trusted_proxy_cidrs=Config.TRUSTED_PROXY_CIDRS,
    )
