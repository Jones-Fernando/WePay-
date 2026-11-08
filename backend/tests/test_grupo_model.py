from database.connection import cursor_for, get_connection_context
from models.grupo_model import GrupoModel


def test_group_model_supports_standalone_and_shared_transactions():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
                ("Group Model", "group-model@example.com", "hash"),
            )
            usuario_id = cursor.lastrowid
            connection.commit()
        finally:
            cursor.close()

    grupo_id = GrupoModel.criar("Grupo sem transacao externa", None, usuario_id)
    assert GrupoModel.buscar_por_id(grupo_id)["nome"] == "Grupo sem transacao externa"

    with get_connection_context() as connection:
        GrupoModel.atualizar(
            grupo_id,
            "Grupo atualizado",
            "Atualizado na transacao compartilhada",
            connection,
        )
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT nome, descricao FROM grupos WHERE id = ?", (grupo_id,)
            )
            grupo = cursor.fetchone()
            assert grupo["nome"] == "Grupo atualizado"
            assert grupo["descricao"] == "Atualizado na transacao compartilhada"
        finally:
            cursor.close()
        connection.commit()

    assert GrupoModel.buscar_por_id(grupo_id)["nome"] == "Grupo atualizado"

    with get_connection_context() as connection:
        GrupoModel.deletar(grupo_id, connection)
        connection.commit()

    assert GrupoModel.buscar_por_id(grupo_id) is None
