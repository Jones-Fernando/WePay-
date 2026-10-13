from models.usuario_model import UsuarioModel
from utils.password_utils import hash_password, check_password
from utils.jwt_utils import generate_refresh_token, generate_token


class AuthService:
    @staticmethod
    def registrar_usuario(nome, email, senha):
        email_normalizado = email.strip().lower()
        if UsuarioModel.buscar_por_email(email_normalizado):
            return None, "Email ja cadastrado no sistema."
        senha_hash = hash_password(senha)
        usuario_id = UsuarioModel.criar(nome.strip(), email_normalizado, senha_hash)
        return usuario_id, None

    @staticmethod
    def autenticar_usuario(email, senha):
        email_normalizado = email.strip().lower()
        usuario = UsuarioModel.buscar_por_email(email_normalizado)
        if not usuario or not check_password(senha, usuario["senha"]):
            return None, "Credenciais invalidas."

        token = generate_token(usuario["id"])
        refresh_token = generate_refresh_token(usuario["id"])
        dados_usuario = {
            "id": usuario["id"],
            "nome": usuario["nome"],
            "email": usuario["email"],
        }
        return {
            "token": token,
            "refresh_token": refresh_token,
            "user": dados_usuario,
        }, None
