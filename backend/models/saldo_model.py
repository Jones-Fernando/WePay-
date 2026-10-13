from database.connection import get_connection_context, cursor_for, fetch_all


class SaldoModel:
    @staticmethod
    def listar_saldos_grupo(grupo_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT s.id, s.grupo_id, s.usuario_id, s.saldo,
                           u.nome, u.email,
                           COALESCE(p.papel, 'participante') AS papel,
                           COALESCE(p.ativo, 0) AS ativo
                    FROM saldos s
                    JOIN usuarios u ON u.id = s.usuario_id
                    LEFT JOIN participantes p
                      ON p.grupo_id = s.grupo_id
                     AND p.usuario_id = s.usuario_id
                    WHERE s.grupo_id = ?
                    ORDER BY s.saldo DESC, u.nome
                    """,
                    (grupo_id,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()
