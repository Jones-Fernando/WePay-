from models.notificacao_model import NotificacaoModel


class NotificacaoService:
    @staticmethod
    def notificar_nova_despesa(grupo_id, autor_id, descricao, valor, conn):
        from database.connection import cursor_for, fetch_all

        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT usuario_id FROM participantes WHERE grupo_id = ? AND ativo = 1 AND usuario_id <> ?",
                (grupo_id, autor_id),
            )
            usuarios = fetch_all(cursor)
        finally:
            cursor.close()

        for row in usuarios:
            NotificacaoModel.criar(
                row["usuario_id"],
                grupo_id,
                "nova_despesa",
                "Nova despesa no grupo",
                f"A despesa '{descricao}' de R$ {valor:.2f} foi adicionada ao grupo.",
                conn=conn,
            )
