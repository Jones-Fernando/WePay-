import argparse

from config import Config


def verificar_mysql():
    import mysql.connector

    connection = mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
    )
    try:
        print("MySQL OK:", connection.get_server_info())
    finally:
        connection.close()


def verificar_gemini():
    if not Config.GEMINI_API_KEY:
        raise RuntimeError("Configure GEMINI_API_KEY para verificar o Gemini.")

    from google import genai

    client = genai.Client(api_key=Config.GEMINI_API_KEY)
    resposta = client.models.generate_content(
        model=Config.GEMINI_MODEL,
        contents="OK?",
    )
    print("Gemini OK:", bool(resposta.text))


def main():
    parser = argparse.ArgumentParser(
        description="Executa verificações externas sob demanda."
    )
    parser.add_argument("--mysql", action="store_true", help="Testa a conexão MySQL.")
    parser.add_argument(
        "--gemini",
        action="store_true",
        help="Faz uma chamada de teste ao Gemini (pode consumir cota).",
    )
    argumentos = parser.parse_args()
    if not argumentos.mysql and not argumentos.gemini:
        parser.error("informe --mysql e/ou --gemini para executar uma verificação")
    if argumentos.mysql:
        verificar_mysql()
    if argumentos.gemini:
        verificar_gemini()


if __name__ == "__main__":
    main()
