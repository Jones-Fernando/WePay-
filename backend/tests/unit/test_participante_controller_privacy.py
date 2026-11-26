from flask import Flask

from controllers import participante_controller
from controllers.participante_controller import ParticipanteController


def test_participant_detail_returns_only_public_user_fields(monkeypatch):
    participante = {
        "id": 9,
        "grupo_id": 4,
        "usuario_id": 17,
        "papel": "participante",
        "ativo": 1,
    }
    usuario = {
        "nome": "Participante",
        "email": "participante@example.com",
        "telefone": "+5511999999999",
        "chave_pix": "sensitive-pix-key",
        "avatar_url": "https://example.com/avatar.jpg",
        "saldo_total": 125.50,
    }
    monkeypatch.setattr(
        participante_controller.ParticipanteModel,
        "buscar_por_id",
        lambda participante_id: participante,
    )
    monkeypatch.setattr(
        participante_controller.ParticipanteModel,
        "buscar",
        lambda grupo_id, usuario_id: True,
    )
    monkeypatch.setattr(
        participante_controller.UsuarioModel,
        "buscar_por_id",
        lambda usuario_id, incluir_excluido=True: usuario,
    )

    app = Flask(__name__)
    with app.app_context():
        response, status = ParticipanteController.buscar(5, 9)

    assert status == 200
    assert response.get_json()["data"]["usuario"] == {
        "nome": "Participante",
        "email": "participante@example.com",
    }
