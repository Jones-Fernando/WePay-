from database.connection import cursor_for, get_connection_context
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel


def test_participant_model_reactivates_and_filters_members():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
                ("Participant Model", "participant-model@example.com", "hash"),
            )
            usuario_id = cursor.lastrowid
            connection.commit()
        finally:
            cursor.close()

    grupo_id = GrupoModel.criar("Grupo participantes model", None, usuario_id)
    ParticipanteModel.adicionar(grupo_id, usuario_id, "admin")
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    assert participante["papel"] == "admin"
    assert ParticipanteModel.buscar_por_id(participante["id"])["id"] == participante["id"]

    ParticipanteModel.remover_por_id(participante["id"])
    assert ParticipanteModel.buscar(grupo_id, usuario_id) is None
    assert ParticipanteModel.buscar(
        grupo_id, usuario_id, apenas_ativo=False
    )["ativo"] == 0
    assert ParticipanteModel.listar_por_grupo(grupo_id) == []
    assert ParticipanteModel.listar_por_grupo(
        grupo_id, incluir_inativos=True
    )[0]["ativo"] == 0

    with get_connection_context() as connection:
        ParticipanteModel.adicionar(grupo_id, usuario_id, "admin", connection)
        connection.commit()

    assert ParticipanteModel.buscar(grupo_id, usuario_id)["ativo"] == 1
