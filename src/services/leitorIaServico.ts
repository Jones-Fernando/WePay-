import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:5000/api";

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

export async function lerReciboComIa(imagem: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<DadosRecibo> {
  const token = await AsyncStorage.getItem("@wepay:token");
  if (!token) throw new Error("Faça login para ler um recibo.");

  const tipo = imagem.mimeType ?? "image/jpeg";
  const extensao = tipo.split("/")[1] ?? "jpg";
  const nomeArquivo = imagem.fileName ?? `recibo.${extensao}`;

  return new Promise<DadosRecibo>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/recibos/ler`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.onload = () => {
      let json: RespostaRecibo;
      try {
        json = JSON.parse(xhr.responseText) as RespostaRecibo;
      } catch {
        reject(new Error("Resposta inválida do servidor: " + xhr.responseText));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json.data);
      } else {
        reject(new Error(json.message ?? json.mensagem ?? "Erro " + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error("Não foi possível conectar ao servidor."));
    xhr.ontimeout = () => reject(new Error("Tempo de conexão esgotado."));
    xhr.timeout = 120000;

    const corpo = new FormData();
    corpo.append("imagem", { uri: imagem.uri, name: nomeArquivo, type: tipo } as unknown as Blob);
    xhr.send(corpo);
  });
}
