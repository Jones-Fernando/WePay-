"""Testes de leitura dos saldos materializados."""

from database.connection import cursor_for, get_connection_context
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from models.saldo_model import SaldoModel


def test_listar_saldos_grupo_inclui_zeros_e_anonimiza_usuario_excluido():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            ids = []
            for indice in range(4):
                cursor.execute(
                    "INSERT INTO usuarios (nome, email, senha) "
                    "VALUES (?, ?, ?)",
                    (
                        f"Saldo User {indice}",
                        f"saldo-user-{indice}@example.com",
                        "hash",
                    ),
                )
                ids.append(cursor.lastrowid)

            grupo_id = GrupoModel.criar("Saldo model", None, ids[0], connection)
            for indice, usuario_id in enumerate(ids):
                ParticipanteModel.adicionar(
                    grupo_id,
                    usuario_id,
                    "admin" if indice == 0 else "participante",
                    connection,
                )

            cursor.execute(
                "UPDATE participantes SET ativo = 0 "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, ids[2]),
            )
            cursor.execute(
                "UPDATE usuarios SET excluido_em = CURRENT_TIMESTAMP "
                "WHERE id = ?",
                (ids[3],),
            )
            cursor.execute(
                "INSERT INTO saldos (grupo_id, usuario_id, saldo) "
                "VALUES (?, ?, ?), (?, ?, ?)",
                (grupo_id, ids[0], 25, grupo_id, ids[1], -25),
            )
            connection.commit()
        finally:
            cursor.close()

    saldos = SaldoModel.listar_saldos_grupo(grupo_id)
    por_usuario = {item["usuario_id"]: item for item in saldos}

    assert len(saldos) == 4
    assert saldos[0]["usuario_id"] == ids[0]
    assert saldos[-1]["usuario_id"] == ids[1]
    assert por_usuario[ids[0]]["saldo"] == 25
    assert por_usuario[ids[0]]["papel"] == "admin"
    assert por_usuario[ids[1]]["saldo"] == -25
    assert por_usuario[ids[2]]["saldo"] == 0
    assert por_usuario[ids[2]]["ativo"] == 0
    assert por_usuario[ids[3]]["nome"] == "Usuário excluído"
    assert por_usuario[ids[3]]["email"] is None
    assert por_usuario[ids[3]]["ativo"] == 0
