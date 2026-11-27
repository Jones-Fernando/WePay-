import pytest

from models import participante_model
from database.connection import cursor_for, get_connection_context
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from models.usuario_model import UsuarioModel


def test_participant_model_rejects_new_members_when_group_is_full(monkeypatch):
    class Cursor:
        description = None

        def __init__(self):
            self.result = None
            self.statements = []

        def execute(self, query, _params=None):
            self.statements.append(query)
            if query.startswith("SELECT id FROM grupos"):
                self.result = {"id": 1}
            elif query.startswith("SELECT ativo"):
                self.result = None
            elif query.startswith("SELECT COUNT(*)"):
                self.result = {"total": 100}

        def fetchone(self):
            return self.result

        def close(self):
            pass

    cursor = Cursor()
    monkeypatch.setattr(
        participante_model, "cursor_for", lambda _connection: cursor
    )

    with pytest.raises(ValueError, match="no maximo 100"):
        ParticipanteModel.adicionar(1, 101, conn=object())

    assert not any(
        statement.startswith("INSERT INTO participantes")
        for statement in cursor.statements
    )


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
    avatar_url = "data:image/png;base64,iVBORw0KGgo="
    assert UsuarioModel.atualizar_avatar(usuario_id, avatar_url)
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    assert participante["papel"] == "admin"
    assert ParticipanteModel.buscar_por_id(participante["id"])["id"] == participante["id"]
    participantes, _ = ParticipanteModel.listar_por_grupo_paginado(grupo_id)
    assert participantes[0]["avatar_url"] == avatar_url

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
