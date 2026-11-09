import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

from models.notificacao_model import NotificacaoModel
from models.push_outbox_model import PushOutboxModel
from services.notificacao_service import NotificacaoService

_LOGGER = logging.getLogger(__name__)
_MAX_ATTEMPTS = 8
_BATCH_SIZE = 100
_RECEIPT_BATCH_SIZE = 1000


def _heartbeat_path():
    value = os.getenv("PUSH_WORKER_HEARTBEAT_FILE", "").strip()
    return Path(value) if value else None


def _write_heartbeat():
    path = _heartbeat_path()
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()


def _health_check(args):
    snapshot = PushOutboxModel.health_snapshot()
    heartbeat = _heartbeat_path()
    heartbeat_age_seconds = None
    heartbeat_ok = True
    if heartbeat is not None:
        try:
            heartbeat_age_seconds = max(0, int(time.time() - heartbeat.stat().st_mtime))
        except FileNotFoundError:
            heartbeat_ok = False
        else:
            heartbeat_ok = heartbeat_age_seconds <= args.heartbeat_max_age_seconds

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
                "oldest_pending_age_seconds",
                "stale_processing",
            )
        },
    }
    print(json.dumps(resultado, ensure_ascii=True, sort_keys=True))
    return 0 if all(checks.values()) else 1


def processar_proxima():
    _write_heartbeat()
    job = PushOutboxModel.reivindicar_proxima(_MAX_ATTEMPTS)
    if job is None:
        return False

    try:
        rows = NotificacaoModel.obter_dados_push(job["notificacao_id"])
        dispositivos = [
            row for row in rows if row.get("token") and row.get("token_id")
        ]
        PushOutboxModel.preparar_destinatarios(job["id"], dispositivos)
        por_token = {row["token"]: row for row in dispositivos}

        PushOutboxModel.marcar_recibos_expirados(job["id"])
        recibos_pendentes = PushOutboxModel.recibos_pendentes(job["id"])
        for inicio in range(0, len(recibos_pendentes), _RECEIPT_BATCH_SIZE):
            _write_heartbeat()
            lote = recibos_pendentes[inicio : inicio + _RECEIPT_BATCH_SIZE]
            recibos = NotificacaoService._consultar_recibos(
                [item["ticket_id"] for item in lote]
            )
            PushOutboxModel.registrar_recibos(job["id"], recibos)

        destinatarios_pendentes = PushOutboxModel.listar_destinatarios(
            job["id"], status="pending"
        )
        for inicio in range(0, len(destinatarios_pendentes), _BATCH_SIZE):
            _write_heartbeat()
            lote = destinatarios_pendentes[inicio : inicio + _BATCH_SIZE]
            linhas = [por_token.get(item["token"]) for item in lote]
            if any(linha is None for linha in linhas):
                raise RuntimeError(
                    "Um dispositivo pendente nao possui dados para montar o push."
                )
            mensagens = [
                NotificacaoService.montar_mensagem_push(linha, linha)
                for linha in linhas
            ]
            tickets = NotificacaoService._enviar_lote_push(mensagens)
            PushOutboxModel.registrar_tickets(
                job["id"],
                [
                    {
                        "destinatario_id": destinatario["id"],
                        "token": destinatario["token"],
                        "ticket": ticket,
                    }
                    for destinatario, ticket in zip(lote, tickets)
                ],
            )

        destinatarios_pendentes = PushOutboxModel.listar_destinatarios(
            job["id"], status="pending"
        )
        if destinatarios_pendentes:
            raise RuntimeError(
                f"{len(destinatarios_pendentes)} dispositivo(s) aguardam nova tentativa."
            )

        if PushOutboxModel.listar_destinatarios(
            job["id"], status="ticketed"
        ):
            PushOutboxModel.agendar_recibos(job["id"])
            return True
    except Exception as erro:
        PushOutboxModel.registrar_falha(
            job["id"], job["tentativas"], erro, _MAX_ATTEMPTS
        )
        _LOGGER.exception(
            "Falha ao processar evento push %s (tentativa %s/%s).",
            job["id"],
            job["tentativas"] + 1,
            _MAX_ATTEMPTS,
        )
        return True

    PushOutboxModel.marcar_enviado(job["id"])
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Processa a fila persistente de notificações push do WePay."
    )
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument(
        "--health-check",
        action="store_true",
        help="Emite um snapshot JSON e retorna falha quando a fila/worker degrada.",
    )
    actions.add_argument(
        "--retry-failed",
        type=int,
        metavar="OUTBOX_ID",
        help="Reabre um evento failed específico para processamento.",
    )
    actions.add_argument(
        "--retry-all-failed",
        action="store_true",
        help="Reabre todos os eventos failed (tokens removidos continuam excluídos).",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Processa no máximo um evento e encerra.",
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
        reprocessados = PushOutboxModel.reprocessar_falhos(args.retry_failed)
        print(json.dumps({"reprocessados": reprocessados}))
        if reprocessados == 0:
            print(
                f"Nenhum evento failed encontrado com id {args.retry_failed}.",
                file=sys.stderr,
            )
            return 1
        return 0
    if args.retry_all_failed:
        reprocessados = PushOutboxModel.reprocessar_falhos()
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
