from mysql.connector.errors import IntegrityError

from models.usuario_model import UsuarioModel
from utils.password_utils import (
    check_password,
    hash_password,
)
from utils.jwt_utils import generate_refresh_token, generate_token

_DUMMY_PASSWORD_HASH = "$2b$12$S4/4uwnAbqqofrACpVOjIecnhPdzBPKRlRmpB.koaCFb7McB25aPa"


class AuthService:
    @staticmethod
    def registrar_usuario(nome, email, senha):
        email_normalizado = email.strip().lower()
        senha_hash = hash_password(senha)
        try:
            usuario_id = UsuarioModel.criar(
                nome.strip(), email_normalizado, senha_hash, email_verificado=True
            )
        except IntegrityError as error:
            if error.errno == 1062:
                return None, None
            raise
        return usuario_id, None

    @staticmethod
    def autenticar_usuario(email, senha):
        email_normalizado = email.strip().lower()
        usuario = UsuarioModel.buscar_por_email(email_normalizado)
        conta_ativa = usuario and usuario.get("excluido_em") is None
        senha_valida = check_password(
            senha,
            usuario["senha"] if conta_ativa else _DUMMY_PASSWORD_HASH,
        )
        if not conta_ativa or not senha_valida:
            return None, "O e-mail ou a senha não conferem. Confira os dois e tente novamente."
        auth_version = int(usuario.get("auth_version", 0))
        token = generate_token(usuario["id"], auth_version)
        refresh_token = generate_refresh_token(usuario["id"], auth_version)
        dados_usuario = {
            "id": usuario["id"],
            "nome": usuario["nome"],
            "email": usuario["email"],
            "saldo_total": usuario["saldo_total"],
            "avatar_url": usuario.get("avatar_url"),
            "pix_chave": usuario.get("pix_chave"),
        }
        return {
            "token": token,
            "refresh_token": refresh_token,
            "user": dados_usuario,
        }, None
