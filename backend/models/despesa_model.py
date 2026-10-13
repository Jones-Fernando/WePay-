from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class DespesaModel:
    @staticmethod
    def listar_por_grupo(grupo_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT d.id, d.grupo_id, d.pagador_id, d.descricao,
                           d.categoria, d.valor, d.data_despesa AS data,
                           d.vencimento, u.nome AS pagador
                    FROM despesas d
                    JOIN usuarios u ON u.id = d.pagador_id
                    WHERE d.grupo_id = ?
                    ORDER BY d.data_despesa DESC, d.id DESC
                    """,
                    (grupo_id,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(despesa_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT * FROM despesas WHERE id = ?", (despesa_id,))
                row = fetch_one(cursor)
                if row:
                    cursor.execute(
                        "SELECT usuario_id, tipo, percentual, valor FROM despesa_divisoes WHERE despesa_id = ? ORDER BY usuario_id",
                        (despesa_id,),
                    )
                    row["divisoes"] = fetch_all(cursor)
                return row
            finally:
                cursor.close()
