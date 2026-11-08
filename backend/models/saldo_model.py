from database.connection import get_connection_context, cursor_for, fetch_all


class SaldoModel:
    @staticmethod
    def listar_saldos_grupo(grupo_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT s.id, p.grupo_id, p.usuario_id,
                           COALESCE(s.saldo, 0) AS saldo,
                           CASE WHEN u.excluido_em IS NULL THEN u.nome
                                ELSE 'Usuário excluído' END AS nome,
                           CASE WHEN u.excluido_em IS NULL THEN u.email
                                ELSE NULL END AS email,
                           COALESCE(p.papel, 'participante') AS papel,
                           CASE WHEN u.excluido_em IS NULL
                                THEN COALESCE(p.ativo, 0)
                                ELSE 0 END AS ativo
                    FROM participantes p
                    JOIN usuarios u ON u.id = p.usuario_id
                    LEFT JOIN saldos s
                      ON s.grupo_id = p.grupo_id
                     AND s.usuario_id = p.usuario_id
                    WHERE p.grupo_id = ?
                    ORDER BY saldo DESC, u.nome
                    """,
                    (grupo_id,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()
