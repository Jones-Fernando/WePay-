from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all

_CATEGORIA_RESOLVIDA = (
    "COALESCE("
    "CONVERT(c.nome USING utf8mb4) COLLATE utf8mb4_unicode_ci, "
    "CONVERT(dp.categoria USING utf8mb4) COLLATE utf8mb4_unicode_ci)"
)
_FILTRO_CATEGORIA = (
    f"(? IS NULL OR {_CATEGORIA_RESOLVIDA} = "
    "CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci)"
)


class DespesaPessoalModel:
    @staticmethod
    def criar(
        usuario_id,
        descricao,
        valor,
        categoria=None,
        tipo="despesa",
        data_despesa=None,
        categoria_id=None,
    ):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO despesas_pessoais "
                    "(usuario_id, descricao, valor, categoria, categoria_id, tipo, data_despesa) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        usuario_id,
                        descricao,
                        valor,
                        categoria,
                        categoria_id,
                        tipo,
                        data_despesa,
                    ),
                )
                item_id = cursor.lastrowid
                conn.commit()
                return item_id
            finally:
                cursor.close()

    @staticmethod
    def listar_por_usuario(
        usuario_id,
        categoria=None,
        tipo=None,
        data_inicio=None,
        data_fim=None,
        limit=50,
        offset=0,
    ):
        categoria_filtro = categoria if categoria else None
        tipo_filtro = tipo if tipo else None
        inicio_filtro = data_inicio if data_inicio else None
        fim_filtro = data_fim if data_fim else None
        params = (
            usuario_id,
            categoria_filtro,
            categoria_filtro,
            tipo_filtro,
            tipo_filtro,
            inicio_filtro,
            inicio_filtro,
            fim_filtro,
            fim_filtro,
        )
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM despesas_pessoais dp
                    LEFT JOIN categorias c ON c.id = dp.categoria_id
                    WHERE dp.usuario_id = ?
                      AND {_FILTRO_CATEGORIA}
                      AND (? IS NULL OR dp.tipo = ?)
                      AND (? IS NULL OR dp.data_despesa >= ?)
                      AND (? IS NULL OR dp.data_despesa <= ?)
                    """,
                    params,
                )
                total = int(fetch_one(cursor)["total"])
                cursor.execute(
                    f"""
                    SELECT {_CATEGORIA_RESOLVIDA} AS categoria,
                           SUM(dp.valor) AS valor
                    FROM despesas_pessoais dp
                    LEFT JOIN categorias c ON c.id = dp.categoria_id
                    WHERE dp.usuario_id = ?
                      AND {_FILTRO_CATEGORIA}
                      AND (? IS NULL OR dp.tipo = ?)
                      AND (? IS NULL OR dp.data_despesa >= ?)
                      AND (? IS NULL OR dp.data_despesa <= ?)
                    GROUP BY {_CATEGORIA_RESOLVIDA}
                    ORDER BY {_CATEGORIA_RESOLVIDA}
                    """,
                    params,
                )
                categorias = fetch_all(cursor)
                cursor.execute(
                    f"""
                    SELECT dp.id, dp.usuario_id, dp.descricao, dp.valor,
                           {_CATEGORIA_RESOLVIDA} AS categoria,
                           dp.categoria_id, dp.tipo,
                           CAST(dp.data_despesa AS CHAR) AS data_despesa,
                           CAST(dp.criado_em AS CHAR) AS criado_em,
                           CAST(dp.atualizado_em AS CHAR) AS atualizado_em
                    FROM despesas_pessoais dp
                    LEFT JOIN categorias c ON c.id = dp.categoria_id
                    WHERE dp.usuario_id = ?
                      AND {_FILTRO_CATEGORIA}
                      AND (? IS NULL OR dp.tipo = ?)
                      AND (? IS NULL OR dp.data_despesa >= ?)
                      AND (? IS NULL OR dp.data_despesa <= ?)
                    ORDER BY dp.data_despesa DESC, dp.id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (*params, limit, offset),
                )
                dados = fetch_all(cursor)
                return dados, {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + len(dados) < total,
                    "categorias": categorias,
                    "valor_total": sum(
                        (row["valor"] for row in categorias), start=0
                    ),
                }
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(despesa_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    f"""
                    SELECT dp.id, dp.usuario_id, dp.descricao, dp.valor,
                           {_CATEGORIA_RESOLVIDA} AS categoria,
                           dp.categoria_id, dp.tipo, dp.data_despesa,
                           dp.criado_em, dp.atualizado_em
                    FROM despesas_pessoais dp
                    LEFT JOIN categorias c ON c.id = dp.categoria_id
                    WHERE dp.id = ?
                    """,
                    (despesa_id,),
                )
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def atualizar(
        despesa_id,
        descricao,
        valor,
        categoria,
        tipo,
        data_despesa,
        categoria_id=None,
    ):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE despesas_pessoais SET descricao = ?, valor = ?, categoria = ?, "
                    "categoria_id = ?, tipo = ?, data_despesa = ?, "
                    "atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (
                        descricao,
                        valor,
                        categoria,
                        categoria_id,
                        tipo,
                        data_despesa,
                        despesa_id,
                    ),
                )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def deletar(despesa_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("DELETE FROM despesas_pessoais WHERE id = ?", (despesa_id,))
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def resumo_periodo(usuario_id, data_inicio, data_fim):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) AS despesas,
                        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) AS receitas
                    FROM despesas_pessoais
                    WHERE usuario_id = ? AND data_despesa BETWEEN ? AND ?
                    """,
                    (usuario_id, data_inicio, data_fim),
                )
                row = fetch_one(cursor) or {"despesas": 0, "receitas": 0}
                row["saldo"] = row["receitas"] - row["despesas"]
                return row
            finally:
                cursor.close()
