import base64

from flask import Flask

from controllers import auth_controller
from controllers.auth_controller import AuthController


def test_profile_avatar_is_validated_and_saved(monkeypatch):
    stored = {}
    image = b"\xff\xd8\xffprofile-image"
    encoded = base64.b64encode(image).decode("ascii")
    monkeypatch.setattr(
        auth_controller.UsuarioModel,
        "atualizar_avatar",
        lambda user_id, avatar_url: stored.update(
            user_id=user_id,
            avatar_url=avatar_url,
        ) or True,
    )
    app = Flask(__name__)

    with app.test_request_context(
        "/api/auth/avatar",
        method="PUT",
        json={"imagem_base64": encoded},
    ):
        response, status = AuthController.atualizar_avatar(17)

    expected_url = f"data:image/jpeg;base64,{encoded}"
    assert status == 200
    assert response.get_json()["data"]["avatar_url"] == expected_url
    assert stored == {"user_id": 17, "avatar_url": expected_url}


def test_profile_avatar_rejects_non_image_payload(monkeypatch):
    save_called = False

    def save_avatar(*_args):
        nonlocal save_called
        save_called = True
        return True

    monkeypatch.setattr(
        auth_controller.UsuarioModel,
        "atualizar_avatar",
        save_avatar,
    )
    app = Flask(__name__)
    encoded = base64.b64encode(b"not an image").decode("ascii")

    with app.test_request_context(
        "/api/auth/avatar",
        method="PUT",
        json={"imagem_base64": encoded},
    ):
        response, status = AuthController.atualizar_avatar(17)

    assert status == 415
    assert "JPEG, PNG ou WEBP" in response.get_json()["message"]
    assert not save_called


def test_profile_avatar_rejects_invalid_base64():
    app = Flask(__name__)

    with app.test_request_context(
        "/api/auth/avatar",
        method="PUT",
        json={"imagem_base64": "not-base64!"},
    ):
        response, status = AuthController.atualizar_avatar(17)

    assert status == 400
    assert "inválido" in response.get_json()["message"]


def test_profile_avatar_rejects_oversized_payload(monkeypatch):
    monkeypatch.setattr(auth_controller, "MAX_AVATAR_BYTES", 3)
    app = Flask(__name__)
    encoded = base64.b64encode(b"\xff\xd8\xffx").decode("ascii")

    with app.test_request_context(
        "/api/auth/avatar",
        method="PUT",
        json={"imagem_base64": encoded},
    ):
        response, status = AuthController.atualizar_avatar(17)

    assert status == 413
    assert "1,5 MB" in response.get_json()["message"]
