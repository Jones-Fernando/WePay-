import {
  getAccessToken,
  refreshAccessToken,
} from "@/services/authSession";
import { API_BASE_URL } from "@/services/apiConfig";

export type DadosRecibo = {
  estabelecimento?: string | null;
  data?: string | null;
  valor_total?: number | null;
  moeda?: string | null;
  categoria_sugerida?: string | null;
};

type RespostaRecibo = {
  data: DadosRecibo;
  message?: string;
  mensagem?: string;
};

type ResultadoUpload = {
  status: number;
  texto: string;
};

export async function lerReciboComIa(imagem: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<DadosRecibo> {
  let token = await getAccessToken();
  if (!token) throw new Error("Faça login para ler um recibo.");

  const tipo = imagem.mimeType ?? "image/jpeg";
  const extensao = tipo.split("/")[1] ?? "jpg";
  const nomeArquivo = imagem.fileName ?? `recibo.${extensao}`;

  const enviar = (accessToken: string) => new Promise<ResultadoUpload>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/recibos/ler`);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.onload = () => resolve({
        status: xhr.status,
        texto: xhr.responseText,
      });
      xhr.onerror = () =>
        reject(new Error("Não foi possível conectar ao servidor."));
      xhr.ontimeout = () => reject(new Error("Tempo de conexão esgotado."));
      xhr.timeout = 120000;

      const corpo = new FormData();
      corpo.append(
        "imagem",
        { uri: imagem.uri, name: nomeArquivo, type: tipo } as unknown as Blob,
      );
      xhr.send(corpo);
    },
  );

  let resposta = await enviar(token);
  if (resposta.status === 401) {
    const tokenRenovado = await refreshAccessToken();
    if (tokenRenovado) {
      token = tokenRenovado;
      resposta = await enviar(token);
    }
  }

  let json: RespostaRecibo;
  try {
    json = JSON.parse(resposta.texto) as RespostaRecibo;
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }
  if (resposta.status < 200 || resposta.status >= 300) {
    throw new Error(json.message ?? json.mensagem ?? "Erro " + resposta.status);
  }
  return json.data;
}
