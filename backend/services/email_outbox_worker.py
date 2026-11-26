import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

from models.email_outbox_model import EmailOutboxModel
from services.email_service import EmailService
from utils.email_token_cipher import decrypt_recovery_token


_LOGGER = logging.getLogger(__name__)
_MAX_ATTEMPTS = 8
_RESERVATION_TIMEOUT_SECONDS = 300


def _heartbeat_path():
    value = os.getenv("EMAIL_OUTBOX_HEARTBEAT_FILE", "").strip()
    return Path(value) if value else None


def _write_heartbeat():
    path = _heartbeat_path()
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()


def _health_check(args):
    snapshot = EmailOutboxModel.health_snapshot(
        _RESERVATION_TIMEOUT_SECONDS
    )
    heartbeat = _heartbeat_path()
    heartbeat_age_seconds = None
    heartbeat_ok = True
    if heartbeat is not None:
        try:
            heartbeat_age_seconds = max(
                0, int(time.time() - heartbeat.stat().st_mtime)
            )
        except FileNotFoundError:
            heartbeat_ok = False
        else:
            heartbeat_ok = (
                heartbeat_age_seconds <= args.heartbeat_max_age_seconds
            )

    checks = {
        "heartbeat": heartbeat_ok,
        "pending_count": int(snapshot["pending"]) <= args.max_pending_count,
        "pending_age": (
            int(snapshot["oldest_pending_age_seconds"])
            <= args.max_pending_age_seconds
        ),
        "failed_events": int(snapshot["failed"]) <= args.max_failed_count,
        "stale_processing": int(snapshot["stale_processing"]) == 0,
    }
    resultado = {
        "status": "ok" if all(checks.values()) else "degraded",
        "checks": checks,
        "heartbeat_age_seconds": heartbeat_age_seconds,
        "queue": {
            key: int(snapshot[key])
            for key in (
                "pending",
                "processing",
                "failed",
                "sent",
                "cancelled",
                "oldest_pending_age_seconds",
                "stale_processing",
            )
        },
    }
    print(json.dumps(resultado, ensure_ascii=True, sort_keys=True))
    return 0 if all(checks.values()) else 1


def processar_proxima(max_tentativas=_MAX_ATTEMPTS):
    _write_heartbeat()
    job = EmailOutboxModel.reivindicar_proxima(
        max_tentativas,
        _RESERVATION_TIMEOUT_SECONDS,
    )
    if job is None:
        return False

    try:
        with EmailOutboxModel.bloquear_token_para_envio(
            job["recuperacao_token_id"]
        ) as token:
            if token is None:
                raise RuntimeError("Token de recuperação não encontrado.")
            if token["usado_em"] is not None or not token["nao_expirado"]:
                expirado = (
                    token["usado_em"] is None and not token["nao_expirado"]
                )
                atualizado = EmailOutboxModel.marcar_token_indisponivel(
                    job["id"], expirado
                )
                if expirado and atualizado:
                    _LOGGER.critical(
                        "E-mail de recuperação %s falhou: token expirou antes do envio.",
                        job["id"],
                    )
                return True

            if not job["token_cifrado"]:
                raise RuntimeError("Token cifrado ausente na outbox.")
            token_em_claro = decrypt_recovery_token(job["token_cifrado"])
            if not EmailService.enviar_recuperacao_senha(
                job["email_destino"],
                token_em_claro,
            ):
                raise RuntimeError("O servidor SMTP não confirmou o envio.")

            EmailOutboxModel.marcar_enviado(job["id"])
        return True
    except Exception as erro:
        atualizado = EmailOutboxModel.registrar_falha(
            job["id"],
            job["tentativas"],
            erro,
            max_tentativas,
        )
        if atualizado and job["tentativas"] >= max_tentativas:
            _LOGGER.critical(
                "E-mail de recuperação %s falhou permanentemente após %s tentativas.",
                job["id"],
                job["tentativas"],
            )
        else:
            _LOGGER.exception(
                "Falha ao processar e-mail de recuperação %s (tentativa %s/%s).",
                job["id"],
                job["tentativas"],
                max_tentativas,
            )
        return True


def main():
    parser = argparse.ArgumentParser(
        description="Processa a outbox persistente de recuperação por e-mail."
    )
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument(
        "--health-check",
        action="store_true",
        help="Emite um snapshot JSON e retorna falha quando a fila degrada.",
    )
    actions.add_argument(
        "--retry-failed",
        type=int,
        metavar="OUTBOX_ID",
        help="Reabre um e-mail failed cujo token ainda seja válido.",
    )
    actions.add_argument(
        "--retry-all-failed",
        action="store_true",
        help="Reabre todos os e-mails failed com tokens ainda válidos.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Processa no máximo um e-mail e encerra.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=2.0,
        help="Intervalo de espera quando a fila estiver vazia (padrão: 2).",
    )
    parser.add_argument("--max-pending-count", type=int, default=100)
    parser.add_argument("--max-pending-age-seconds", type=int, default=300)
    parser.add_argument("--max-failed-count", type=int, default=0)
    parser.add_argument("--heartbeat-max-age-seconds", type=int, default=15)
    args = parser.parse_args()
    if args.poll_seconds <= 0:
        parser.error("--poll-seconds deve ser maior que zero.")
    if min(
        args.max_pending_count,
        args.max_pending_age_seconds,
        args.max_failed_count,
        args.heartbeat_max_age_seconds,
    ) < 0:
        parser.error("Os limites do health check não podem ser negativos.")
    if args.health_check:
        return _health_check(args)
    if args.retry_failed is not None:
        if args.retry_failed <= 0:
            parser.error("OUTBOX_ID deve ser maior que zero.")
        reprocessados = EmailOutboxModel.reprocessar_falhos(args.retry_failed)
        print(json.dumps({"reprocessados": reprocessados}))
        if reprocessados == 0:
            print(
                "Nenhum e-mail failed com token válido encontrado para esse ID.",
                file=sys.stderr,
            )
            return 1
        return 0
    if args.retry_all_failed:
        reprocessados = EmailOutboxModel.reprocessar_falhos()
        print(json.dumps({"reprocessados": reprocessados}))
        return 0

    while True:
        _write_heartbeat()
        processado = processar_proxima()
        if args.once:
            return 0
        if not processado:
            time.sleep(args.poll_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(main())
