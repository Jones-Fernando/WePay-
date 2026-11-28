from mysql.connector.errors import IntegrityError

from models.usuario_model import UsuarioModel
from utils.password_utils import (
    MAX_PASSWORD_BYTES,
    check_legacy_password,
    check_password,
    hash_password,
    is_legacy_password_hash,
)
from utils.jwt_utils import generate_refresh_token, generate_token

_DUMMY_PASSWORD_HASH = "$2b$12$S4/4uwnAbqqofrACpVOjIecnhPdzBPKRlRmpB.koaCFb7McB25aPa"
_INVALID_CREDENTIALS_MESSAGE = (
    "O e-mail ou a senha não conferem. Confira os dois e tente novamente."
)


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
        if usuario is None or usuario.get("excluido_em") is not None:
            check_password(senha, _DUMMY_PASSWORD_HASH)
            return None, _INVALID_CREDENTIALS_MESSAGE

        password_hash = usuario["senha"]
        if is_legacy_password_hash(password_hash):
            if not check_legacy_password(senha, password_hash):
                check_password(senha, _DUMMY_PASSWORD_HASH)
                return None, _INVALID_CREDENTIALS_MESSAGE
            try:
                password_bytes = senha.encode("utf-8")
            except (AttributeError, UnicodeEncodeError):
                return None, _INVALID_CREDENTIALS_MESSAGE
            if len(password_bytes) > MAX_PASSWORD_BYTES:
                return None, _INVALID_CREDENTIALS_MESSAGE

            upgraded_hash = hash_password(senha)
            if not UsuarioModel.atualizar_hash_senha_legado(
                usuario["id"], password_hash, upgraded_hash
            ):
                return None, _INVALID_CREDENTIALS_MESSAGE
            usuario["senha"] = upgraded_hash
        elif not check_password(senha, password_hash):
            return None, _INVALID_CREDENTIALS_MESSAGE

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
