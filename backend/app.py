import os
import subprocess
import sys

import click
from flask import Flask
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

from config import Config
from database.connection import (
    cursor_for,
    fetch_all,
    get_connection_context,
    initialize_database,
)
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


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["MAX_CONTENT_LENGTH"] = 9 * 1024 * 1024

    limiter.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
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

    @app.errorhandler(RequestEntityTooLarge)
    def request_too_large(_error):
        return ResponseUtils.erro(
            "O corpo da requisição excede o limite permitido.",
            status=413,
        )

    @app.errorhandler(429)
    def too_many_requests(_error):
        return ResponseUtils.erro(
            "Muitas tentativas. Tente novamente mais tarde.",
            status=429,
        )

    @app.errorhandler(404)
    def not_found(_error):
        return ResponseUtils.erro("Rota nao encontrada.", status=404)

    @app.errorhandler(500)
    def internal_error(error):
        exception = error.original_exception
        if exception:
            app.logger.error(
                "Erro interno da API.",
                exc_info=(
                    type(exception),
                    exception,
                    exception.__traceback__,
                ),
            )
        return ResponseUtils.erro("Erro interno do servidor.", status=500)

    @app.route("/", methods=["GET"])
    def index():
        return {"status": "Online", "projeto": "wepay"}, 200

    @app.route("/health/live", methods=["GET"])
    def liveness():
        """Confirma que o processo da API está ativo, sem consultar dependências."""
        return {"status": "Online"}, 200

    @app.route("/health", methods=["GET"])
    @app.route("/health/ready", methods=["GET"])
    def readiness():
        """Verifica dependências obrigatórias para receber tráfego."""
        database_ok = True
        try:
            with get_connection_context() as connection:
                cursor = connection.cursor()
                try:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                finally:
                    cursor.close()
        except Exception:
            database_ok = False
            app.logger.exception("Readiness check do banco falhou")

        try:
            rate_limit_storage_ok = limiter.storage.check()
        except Exception:
            rate_limit_storage_ok = False
            app.logger.exception(
                "Readiness check do storage de rate limit falhou"
            )
        if not rate_limit_storage_ok:
            app.logger.error("Storage de rate limit indisponivel")

        ready = database_ok and rate_limit_storage_ok
        return {
            "status": "Online" if ready else "indisponivel",
            "database": "Online" if database_ok else "erro",
            "rate_limit_storage": (
                "Online" if rate_limit_storage_ok else "erro"
            ),
        }, 200 if ready else 503

    @app.cli.command("init-db")
    def init_db_command():
        """Cria ou atualiza o schema fora do ciclo de inicialização da API."""
        initialize_database()
        print("Schema do WEPAY inicializado.")

    @app.cli.command("invalidate-legacy-passwords")
    @click.option(
        "--apply",
        "apply_changes",
        is_flag=True,
        help="Invalida as senhas legadas e revoga as sessões dessas contas.",
    )
    def invalidate_legacy_passwords_command(apply_changes):
        """Exige redefinição para contas que ainda usam SHA-256 legado."""
        from services.legacy_password_migration import (
            invalidate_legacy_passwords,
        )

        try:
            with get_connection_context() as connection:
                try:
                    count = invalidate_legacy_passwords(
                        connection,
                        dry_run=not apply_changes,
                    )
                    if apply_changes:
                        connection.commit()
                except Exception:
                    connection.rollback()
                    raise
        except Exception as error:
            app.logger.exception("Falha na migração de senhas legadas.")
            raise click.ClickException(
                "Migração de senhas falhou; nenhuma alteração foi confirmada."
            ) from error

        if apply_changes:
            click.echo(
                f"{count} conta(s) atualizada(s). "
                "Essas contas precisam redefinir a senha antes de entrar."
            )
        else:
            click.echo(
                f"Dry-run: {count} conta(s) precisam redefinir a senha. "
                "Pare a API antes de executar novamente com --apply."
            )

    @app.cli.command("gemini-usage")
    @click.option(
        "--days",
        type=click.IntRange(min=1, max=365),
        default=7,
        show_default=True,
        help="Quantidade de dias de métricas a exibir.",
    )
    def gemini_usage_command(days):
        """Exibe o volume diário de chamadas Gemini e bytes enviados."""
        from models.gemini_usage_model import GeminiUsageModel

        linhas = GeminiUsageModel.resumo(days)
        if not linhas:
            click.echo("Nenhuma chamada Gemini registrada no período.")
            return
        for linha in linhas:
            mib = int(linha["bytes_imagem"]) / (1024 * 1024)
            click.echo(
                f"{linha['data_utc']} modelo={linha['modelo']} "
                f"solicitacoes={linha['solicitacoes']} "
                f"imagem_mib={mib:.2f} "
                f"alerta_emitido={bool(linha['alerta_emitido'])}"
            )

    @app.cli.command("reconcile-balances")
    @click.option(
        "--group-id",
        type=click.IntRange(min=1),
        help="Reconcilia apenas o grupo informado; por padrão, verifica todos.",
    )
    @click.option(
        "--check-only",
        is_flag=True,
        help="Detecta divergências sem modificar os saldos.",
    )
    def reconcile_balances_command(group_id, check_only):
        """Compara os saldos materializados com despesas, divisões e pagamentos."""
        from services.financeiro_service import FinanceiroService

        if group_id is None:
            with get_connection_context() as connection:
                cursor = cursor_for(connection)
                try:
                    cursor.execute("SELECT id FROM grupos ORDER BY id")
                    grupos = [int(row["id"]) for row in fetch_all(cursor)]
                finally:
                    cursor.close()
        else:
            grupos = [group_id]

        total_divergencias = 0
        for current_group_id in grupos:
            try:
                resultado = FinanceiroService.reconciliar_saldos(
                    current_group_id,
                    corrigir=not check_only,
                )
            except LookupError as error:
                raise click.ClickException(str(error)) from error

            divergencias = resultado["divergencias"]
            total_divergencias += len(divergencias)
            if divergencias:
                acao = "corrigidas" if resultado["corrigidas"] else "encontradas"
                click.echo(
                    f"Grupo {current_group_id}: {len(divergencias)} divergência(s) {acao}."
                )
            else:
                click.echo(f"Grupo {current_group_id}: saldos consistentes.")

        if check_only and total_divergencias:
            raise click.ClickException(
                f"Foram encontradas {total_divergencias} divergência(s); "
                "execute sem --check-only para corrigi-las."
            )

    @app.cli.command("cleanup-retained-data")
    @click.option(
        "--batch-size",
        type=click.IntRange(min=1, max=5000),
        default=500,
        show_default=True,
        help="Máximo de registros por lote de exclusão.",
    )
    @click.option(
        "--dry-run",
        is_flag=True,
        help="Conta os registros elegíveis sem removê-los.",
    )
    def cleanup_retained_data_command(batch_size, dry_run):
        """Remove registros expirados conforme os prazos de retenção."""
        import json
        from datetime import datetime, timezone

        from models.data_retention_model import DataRetentionModel

        try:
            counts = DataRetentionModel.limpar_registros_expirados(
                batch_size=batch_size,
                dry_run=dry_run,
            )
        except Exception as error:
            app.logger.exception("Falha na rotina de retenção de dados.")
            raise click.ClickException(
                "A rotina de retenção falhou; consulte o journal para detalhes."
            ) from error

        click.echo(
            json.dumps(
                {
                    "modo": "dry-run" if dry_run else "delete",
                    "concluido_em": datetime.now(timezone.utc).isoformat(),
                    "registros": counts,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )

    return app


def _start_email_outbox_worker():
    return subprocess.Popen(
        [sys.executable, "-m", "services.email_outbox_worker"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )


def _stop_email_outbox_worker(worker_process):
    if worker_process is None or worker_process.poll() is not None:
        return
    worker_process.terminate()
    try:
        worker_process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        worker_process.kill()
        worker_process.wait()


def run_development_server():
    if Config.ENVIRONMENT != "development":
        raise RuntimeError(
            "Execute o backend em produção com "
            "`waitress-serve --host=0.0.0.0 --port=5000 wsgi:app`."
        )
    app = create_app()
    debug = os.getenv("FLASK_DEBUG", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    worker_process = None
    if not debug or os.getenv("WERKZEUG_RUN_MAIN") == "true":
        worker_process = _start_email_outbox_worker()
        app.logger.info("Worker de e-mails iniciado com a API.")
    try:
        app.run(
            debug=debug,
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", 5000)),
        )
    finally:
        _stop_email_outbox_worker(worker_process)


if __name__ == "__main__":
    run_development_server()
