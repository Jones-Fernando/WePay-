from models.usuario_model import UsuarioModel
from utils.password_utils import (
    MAX_PASSWORD_BYTES,
    check_password,
    hash_password,
    is_legacy_password_hash,
)
from utils.jwt_utils import generate_refresh_token, generate_token


class AuthService:
    @staticmethod
    def registrar_usuario(nome, email, senha):
        email_normalizado = email.strip().lower()
        if UsuarioModel.buscar_por_email(email_normalizado):
            return None, "Email ja cadastrado no sistema."
        senha_hash = hash_password(senha)
        usuario_id = UsuarioModel.criar(
            nome.strip(), email_normalizado, senha_hash, email_verificado=True
        )
        return usuario_id, None

    @staticmethod
    def autenticar_usuario(email, senha):
        email_normalizado = email.strip().lower()
        usuario = UsuarioModel.buscar_por_email(email_normalizado)
        if (
            not usuario
            or usuario.get("excluido_em") is not None
            or not check_password(senha, usuario["senha"])
        ):
            return None, "Credenciais invalidas."
        if (
            is_legacy_password_hash(usuario["senha"])
            and len(senha.encode("utf-8")) <= MAX_PASSWORD_BYTES
        ):
            UsuarioModel.atualizar_hash_senha_legado(
                usuario["id"],
                usuario["senha"],
                hash_password(senha),
            )
        auth_version = int(usuario.get("auth_version", 0))
        token = generate_token(usuario["id"], auth_version)
        refresh_token = generate_refresh_token(usuario["id"], auth_version)
        dados_usuario = {
            "id": usuario["id"],
            "nome": usuario["nome"],
            "email": usuario["email"],
            "saldo_total": usuario["saldo_total"],
        }
        return {
            "token": token,
            "refresh_token": refresh_token,
            "user": dados_usuario,
        }, None
