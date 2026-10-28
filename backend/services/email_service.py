import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Config


class EmailService:
    @staticmethod
    def _enviar_email(email_destino: str, assunto: str, corpo_texto: str, corpo_html: str | None = None) -> bool:
        if not Config.EMAIL_REMETENTE or not Config.EMAIL_SENHA_APP:
            return False

        mensagem = MIMEMultipart("alternative")
        mensagem["Subject"] = assunto
        mensagem["From"] = f"WePay <{Config.EMAIL_REMETENTE}>"
        mensagem["To"] = email_destino
        mensagem.attach(MIMEText(corpo_texto, "plain", "utf-8"))
        if corpo_html:
            mensagem.attach(MIMEText(corpo_html, "html", "utf-8"))

        try:
            if Config.EMAIL_PORT == 465:
                with smtplib.SMTP_SSL(Config.EMAIL_SERVER, Config.EMAIL_PORT, timeout=15) as servidor:
                    servidor.login(Config.EMAIL_REMETENTE, Config.EMAIL_SENHA_APP)
                    servidor.sendmail(Config.EMAIL_REMETENTE, email_destino, mensagem.as_string())
            else:
                with smtplib.SMTP(Config.EMAIL_SERVER, Config.EMAIL_PORT, timeout=15) as servidor:
                    servidor.ehlo()
                    servidor.starttls()
                    servidor.ehlo()
                    servidor.login(Config.EMAIL_REMETENTE, Config.EMAIL_SENHA_APP)
                    servidor.sendmail(Config.EMAIL_REMETENTE, email_destino, mensagem.as_string())
            return True
        except (smtplib.SMTPException, OSError):
            return False

    @staticmethod
    def enviar_recuperacao_senha(email_destino: str, token: str) -> bool:
        link = f"{Config.APP_DEEP_LINK_URL}redefinir-senha?token={token}"
        texto = (
            "Olá!\n\n"
            "Recebemos uma solicitação de recuperação da sua conta WePay.\n\n"
            f"Use este link para criar uma nova senha:\n{link}\n\n"
            "O link expira em 30 minutos e pode ser usado uma única vez.\n\n"
            "Caso você não tenha solicitado a recuperação, ignore este e-mail.\n\n"
            "Equipe WePay"
        )
        html = f"""
        <html><body style='font-family:Arial,sans-serif;background:#F5FBF7;padding:20px'>
          <div style='max-width:480px;margin:auto;background:#FFFFFF;border-radius:16px;padding:28px'>
            <h2 style='color:#0B3B33'>WePay</h2>
            <p>Recebemos uma solicitação de recuperação de senha.</p>
            <p><a href='{link}' style='display:inline-block;background:#00C896;color:#0B3B33;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold'>Redefinir senha</a></p>
            <p style='color:#6B8F86;font-size:13px'>O link expira em 30 minutos e pode ser usado uma única vez.</p>
          </div>
        </body></html>
        """
        return EmailService._enviar_email(email_destino, "WePay - Recuperação de senha", texto, html)

    @staticmethod
    def enviar_convite(email_destino: str, grupo_nome: str, token: str) -> bool:
        link = f"{Config.APP_DEEP_LINK_URL}convite?token={token}"
        texto = (
            "Olá!\n\n"
            f"Você recebeu um convite para participar do grupo '{grupo_nome}' no WePay.\n\n"
            f"Aceite o convite aqui:\n{link}\n\n"
            "O convite expira em 7 dias.\n\n"
            "Equipe WePay"
        )
        html = f"""
        <html><body style='font-family:Arial,sans-serif;background:#F5FBF7;padding:20px'>
          <div style='max-width:480px;margin:auto;background:#FFFFFF;border-radius:16px;padding:28px'>
            <h2 style='color:#0B3B33'>Convite WePay</h2>
            <p>Você foi convidado para o grupo <strong>{grupo_nome}</strong>.</p>
            <p><a href='{link}' style='display:inline-block;background:#00C896;color:#0B3B33;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold'>Aceitar convite</a></p>
            <p style='color:#6B8F86;font-size:13px'>O convite expira em 7 dias.</p>
          </div>
        </body></html>
        """
        return EmailService._enviar_email(email_destino, f"WePay - Convite para {grupo_nome}", texto, html)

    @staticmethod
    def enviar_email_teste(email_destino: str) -> bool:
        return EmailService._enviar_email(
            email_destino,
            "WePay - Teste de Email",
            "Este é um email de teste do WePay.",
        )
