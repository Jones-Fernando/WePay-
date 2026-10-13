
import json

from google import genai
from google.genai import types

from config import Config


class GeminiReceiptError(Exception):
    """Erro controlado durante a leitura do recibo."""


def ler_recibo(imagem: bytes, mime_type: str) -> dict:
    api_key = Config.GEMINI_API_KEY
    model = Config.GEMINI_MODEL

    if not api_key:
        raise GeminiReceiptError(
            "A chave da API do Gemini não está configurada."
        )

    prompt = """
    Analise a imagem de um recibo ou comprovante de compra.

    Extraia somente informações visíveis na imagem.
    Não invente dados ausentes ou ilegíveis.

    Responda exclusivamente em JSON válido, com esta estrutura:
    {
      "estabelecimento": "nome ou null",
      "data": "AAAA-MM-DD ou null",
      "valor_total": 0.00,
      "moeda": "BRL",
      "itens": [
        {
          "descricao": "nome do item",
          "quantidade": 1,
          "valor_unitario": 0.00,
          "valor_total": 0.00
        }
      ],
      "categoria_sugerida": "categoria ou null"
    }

    Use null quando um campo não puder ser identificado.
    Não confunda subtotal, valor pago e troco com o valor total.
    Se houver dúvida sobre um valor, retorne null nesse campo.
    A categoria deve ser apenas uma sugestão.
    Não execute ações nem cadastre despesas.
    """

    try:
        client = genai.Client(api_key=api_key)

        resposta = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(
                    data=imagem,
                    mime_type=mime_type,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
            ),
        )

        if not resposta.text:
            raise GeminiReceiptError(
                "A IA não retornou dados para o recibo."
            )

        dados = json.loads(resposta.text)

        if not isinstance(dados, dict):
            raise GeminiReceiptError(
                "A resposta da IA está em formato inválido."
            )

        return dados

    except GeminiReceiptError:
        raise
    except json.JSONDecodeError as erro:
        raise GeminiReceiptError(
            "Não foi possível interpretar os dados do recibo."
        ) from erro
    except Exception as erro:
        # Registre detalhes técnicos apenas nos logs internos,
        # sem expor a chave ou os dados sensíveis ao aplicativo.
        raise GeminiReceiptError(
            "Não foi possível processar o recibo. Tente novamente."
        ) from erro
