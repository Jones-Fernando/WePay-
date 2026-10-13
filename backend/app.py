import os

from flask import Flask
from flask_cors import CORS

from config import Config
from database.connection import initialize_database
from utils.rate_limiter import limiter
from utils.response_utils import ResponseUtils

from routes.auth_routes import auth_bp
from routes.usuario_routes import usuario_bp
from routes.grupo_routes import grupo_bp
from routes.participante_routes import participante_bp
from routes.despesa_routes import despesa_bp
from routes.despesa_pessoal_routes import despesa_pessoal_bp
from routes.saldo_routes import saldo_bp
from routes.dashboard_routes import dashboard_bp
from routes.lembrete_routes import lembrete_bp
from routes.pagamento_routes import pagamento_bp
from routes.categoria_routes import categoria_bp
from routes.notificacao_routes import notificacao_bp
from routes.recibo_routes import recibo_bp

initialize_database()

app = Flask(__name__)
app.config.from_object(Config)

limiter.init_app(app)
CORS(
    app,
    resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(usuario_bp, url_prefix="/api/usuarios")
app.register_blueprint(grupo_bp, url_prefix="/api/grupos")
app.register_blueprint(participante_bp, url_prefix="/api/participantes")
app.register_blueprint(despesa_bp, url_prefix="/api/despesas")
app.register_blueprint(despesa_pessoal_bp, url_prefix="/api/despesas-pessoais")
app.register_blueprint(saldo_bp, url_prefix="/api/saldos")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(lembrete_bp, url_prefix="/api/lembretes")
app.register_blueprint(pagamento_bp, url_prefix="/api/pagamentos")
app.register_blueprint(categoria_bp, url_prefix="/api/categorias")
app.register_blueprint(notificacao_bp, url_prefix="/api/notificacoes")
app.register_blueprint(recibo_bp, url_prefix="/api/recibos")


@app.errorhandler(429)
def too_many_requests(error):
    return ResponseUtils.erro(
        "Muitas tentativas. Tente novamente mais tarde.",
        status=429,
    )


@app.errorhandler(404)
def not_found(error):
    return ResponseUtils.erro("Rota nao encontrada.", status=404)


@app.errorhandler(500)
def internal_error(error):
    return ResponseUtils.erro("Erro interno do servidor.", status=500)


@app.route("/", methods=["GET"])
def index():
    return {"status": "Online", "projeto": "wepay"}, 200


if __name__ == "__main__":
    app.run(
        debug=Config.ENVIRONMENT != "production",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", 5000)),
    )
