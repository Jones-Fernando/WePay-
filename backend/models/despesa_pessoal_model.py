from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class DespesaPessoalModel:
    @staticmethod
    def criar(usuario_id, descricao, valor, categoria=None, tipo="despesa", data_despesa=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO despesas_pessoais (usuario_id, descricao, valor, categoria, tipo, data_despesa) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        usuario_id,
                        descricao,
                        valor,
                        categoria,
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
    def listar_por_usuario(usuario_id, categoria=None, tipo=None, data_inicio=None, data_fim=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    "SELECT id, usuario_id, descricao, valor, categoria, tipo, "
                    "data_despesa AS data FROM despesas_pessoais WHERE usuario_id = ?"
                )
                params = [usuario_id]
                if categoria:
                    query += " AND categoria = ?"
                    params.append(categoria)
                if tipo:
                    query += " AND tipo = ?"
                    params.append(tipo)
                if data_inicio:
                    query += " AND data_despesa >= ?"
                    params.append(data_inicio)
                if data_fim:
                    query += " AND data_despesa <= ?"
                    params.append(data_fim)
                query += " ORDER BY data_despesa DESC, id DESC"
                cursor.execute(query, tuple(params))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(despesa_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT * FROM despesas_pessoais WHERE id = ?", (despesa_id,))
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def atualizar(despesa_id, descricao, valor, categoria, tipo, data_despesa):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE despesas_pessoais SET descricao = ?, valor = ?, categoria = ?, "
                    "tipo = ?, data_despesa = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (descricao, valor, categoria, tipo, data_despesa, despesa_id),
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
