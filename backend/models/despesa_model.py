from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class DespesaModel:
    @staticmethod
    def listar_por_grupo(grupo_id, limit=50, offset=0):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT COUNT(*) AS total, COALESCE(SUM(valor), 0) AS valor_total "
                    "FROM despesas WHERE grupo_id = ?",
                    (grupo_id,),
                )
                resumo = fetch_one(cursor)
                cursor.execute(
                    "SELECT categoria, SUM(valor) AS valor "
                    "FROM despesas WHERE grupo_id = ? "
                    "GROUP BY categoria ORDER BY categoria",
                    (grupo_id,),
                )
                categorias = fetch_all(cursor)
                cursor.execute(
                    """
                    SELECT d.id, d.grupo_id, d.pagador_id, d.criado_por,
                           d.descricao,
                           d.categoria, d.valor, d.data_despesa,
                           d.vencimento,
                           CAST(d.criado_em AS CHAR) AS criado_em,
                           (SELECT COUNT(*)
                            FROM despesa_divisoes dd
                            WHERE dd.despesa_id = d.id) AS participantes_count,
                           u.nome AS pagador_nome
                    FROM despesas d
                    JOIN usuarios u ON u.id = d.pagador_id
                    WHERE d.grupo_id = ?
                    ORDER BY d.data_despesa DESC, d.id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (grupo_id, limit, offset),
                )
                dados = fetch_all(cursor)
                total = int(resumo["total"])
                return dados, {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + len(dados) < total,
                    "categorias": categorias,
                    "valor_total": resumo["valor_total"],
                }
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(despesa_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT d.*, u.nome AS pagador_nome FROM despesas d "
                    "JOIN usuarios u ON u.id = d.pagador_id WHERE d.id = ?",
                    (despesa_id,),
                )
                row = fetch_one(cursor)
                if row:
                    cursor.execute(
                        "SELECT dd.usuario_id, dd.tipo, dd.percentual, dd.valor, u.nome "
                        "FROM despesa_divisoes dd JOIN usuarios u ON u.id = dd.usuario_id "
                        "WHERE dd.despesa_id = ? ORDER BY u.nome",
                        (despesa_id,),
                    )
                    row["divisoes"] = fetch_all(cursor)
                return row
            finally:
                cursor.close()
