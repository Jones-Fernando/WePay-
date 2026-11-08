import argparse
import logging
import time

from models.notificacao_model import NotificacaoModel
from models.push_outbox_model import PushOutboxModel
from services.notificacao_service import NotificacaoService

_LOGGER = logging.getLogger(__name__)
_MAX_ATTEMPTS = 8
_BATCH_SIZE = 100


def processar_proxima():
    job = PushOutboxModel.reivindicar_proxima(_MAX_ATTEMPTS)
    if job is None:
        return False

    try:
        rows = NotificacaoModel.obter_dados_push(job["notificacao_id"])
        mensagens = [
            NotificacaoService.montar_mensagem_push(row, row)
            for row in rows
            if row["token"]
        ]
        for inicio in range(0, len(mensagens), _BATCH_SIZE):
            NotificacaoService._enviar_lote_push(
                mensagens[inicio : inicio + _BATCH_SIZE]
            )
    except Exception as erro:
        PushOutboxModel.registrar_falha(
            job["id"], job["tentativas"], erro, _MAX_ATTEMPTS
        )
        _LOGGER.exception(
            "Falha ao processar evento push %s (tentativa %s/%s).",
            job["id"],
            job["tentativas"],
            _MAX_ATTEMPTS,
        )
        return True

    PushOutboxModel.marcar_enviado(job["id"])
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Processa a fila persistente de notificações push do WePay."
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
    args = parser.parse_args()
    if args.poll_seconds <= 0:
        parser.error("--poll-seconds deve ser maior que zero.")

    while True:
        processado = processar_proxima()
        if args.once:
            return
        if not processado:
            time.sleep(args.poll_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
