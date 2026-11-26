from contextlib import nullcontext

from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class NotificacaoModel:
    @staticmethod
    def obter_preferencias(usuario_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT notificacoes_ativas, sons_notificacoes_ativos,
                           notificacoes_despesas_ativas,
                           notificacoes_cobrancas_ativas
                    FROM usuarios WHERE id = ? AND excluido_em IS NULL
                    """,
                    (usuario_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    return None
                return {
                    "notificacoes": bool(row["notificacoes_ativas"]),
                    "sons": bool(row["sons_notificacoes_ativos"]),
                    "despesas": bool(row["notificacoes_despesas_ativas"]),
                    "cobrancas": bool(row["notificacoes_cobrancas_ativas"]),
                }
            finally:
                cursor.close()

    @staticmethod
    def atualizar_preferencias(
        usuario_id,
        notificacoes,
        sons,
        despesas=True,
        cobrancas=True,
    ):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE usuarios
                    SET notificacoes_ativas = ?,
                        sons_notificacoes_ativos = ?,
                        notificacoes_despesas_ativas = ?,
                        notificacoes_cobrancas_ativas = ?
                    WHERE id = ? AND excluido_em IS NULL
                    """,
                    (
                        notificacoes,
                        sons,
                        despesas,
                        cobrancas,
                        usuario_id,
                    ),
                )
                atualizado = cursor.rowcount > 0
                if not atualizado:
                    cursor.execute(
                        "SELECT id FROM usuarios "
                        "WHERE id = ? AND excluido_em IS NULL",
                        (usuario_id,),
                    )
                    atualizado = cursor.fetchone() is not None
                conn.commit()
                return atualizado
            finally:
                cursor.close()

    @staticmethod
    def registrar_push_token(usuario_id, token, plataforma):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        usuario_id = VALUES(usuario_id),
                        plataforma = VALUES(plataforma),
                        atualizado_em = CURRENT_TIMESTAMP
                    """,
                    (usuario_id, token, plataforma),
                )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def remover_push_token(usuario_id, token):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "DELETE FROM expo_push_tokens "
                    "WHERE usuario_id = ? AND token = ?",
                    (usuario_id, token),
                )
                removido = cursor.rowcount > 0
                conn.commit()
                return removido
            finally:
                cursor.close()

    @staticmethod
    def listar_tokens_push(usuario_ids):
        if not usuario_ids:
            return []
        placeholders = ", ".join("?" for _ in usuario_ids)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    f"""
                    SELECT t.id AS token_id, t.usuario_id, t.token,
                           u.sons_notificacoes_ativos
                    FROM expo_push_tokens t
                    JOIN usuarios u ON u.id = t.usuario_id
                    WHERE u.notificacoes_ativas = 1
                      AND u.excluido_em IS NULL
                      AND t.usuario_id IN ({placeholders})
                    """,
                    tuple(usuario_ids),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def obter_dados_push(notificacao_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT t.id AS token_id, n.usuario_id, n.grupo_id,
                           n.referencia_id,
                           n.tipo, n.titulo,
                           g.nome AS grupo_nome,
                           u.sons_notificacoes_ativos, t.token
                    FROM notificacoes n
                    JOIN usuarios u ON u.id = n.usuario_id
                    LEFT JOIN grupos g ON g.id = n.grupo_id
                    LEFT JOIN expo_push_tokens t ON t.usuario_id = u.id
                    WHERE n.id = ?
                      AND u.notificacoes_ativas = 1
                      AND u.excluido_em IS NULL
                    """,
                    (notificacao_id,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def criar(
        usuario_id,
        grupo_id,
        tipo,
        titulo,
        mensagem,
        conn=None,
        referencia_id=None,
    ):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO notificacoes "
                    "(usuario_id, grupo_id, referencia_id, tipo, titulo, mensagem) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        usuario_id,
                        grupo_id,
                        referencia_id,
                        tipo,
                        titulo,
                        mensagem,
                    ),
                )
                item_id = cursor.lastrowid
                if tipo in {"nova_despesa", "cobranca"}:
                    from models.push_outbox_model import PushOutboxModel

                    PushOutboxModel.enfileirar(item_id, connection)
                if conn is None:
                    connection.commit()
                return item_id
            finally:
                cursor.close()

    @staticmethod
    def listar(usuario_id, somente_nao_lidas=False, limit=50, offset=0):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                filtro_nao_lidas = 1 if somente_nao_lidas else 0
                cursor.execute(
                    """
                    SELECT COUNT(*) AS total
                    FROM notificacoes
                    WHERE usuario_id = ? AND (? = 0 OR lida = 0)
                    """,
                    (usuario_id, filtro_nao_lidas),
                )
                total = int(fetch_one(cursor)["total"])
                cursor.execute(
                    """
                    SELECT n.id, n.grupo_id, n.referencia_id,
                           g.nome AS grupo_nome, n.tipo, n.titulo,
                           n.mensagem, n.lida, n.criado_em
                    FROM notificacoes n
                    LEFT JOIN grupos g ON g.id = n.grupo_id
                    WHERE n.usuario_id = ? AND (? = 0 OR n.lida = 0)
                    ORDER BY n.criado_em DESC, n.id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (usuario_id, filtro_nao_lidas, limit, offset),
                )
                return fetch_all(cursor), {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + limit < total,
                }
            finally:
                cursor.close()

    @staticmethod
    def marcar_lida(usuario_id, notificacao_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?",
                    (notificacao_id, usuario_id),
                )
                atualizado = cursor.rowcount
                conn.commit()
                return atualizado > 0
            finally:
                cursor.close()

    @staticmethod
    def marcar_todas_lidas(usuario_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE notificacoes SET lida = 1 "
                    "WHERE usuario_id = ? AND lida = 0",
                    (usuario_id,),
                )
                atualizadas = cursor.rowcount
                conn.commit()
                return atualizadas
            finally:
                cursor.close()
