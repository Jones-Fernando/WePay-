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
  const corpo = new FormData();
  corpo.append(
    "imagem",
    {
      uri: imagem.uri,
      name: imagem.fileName ?? `recibo.${extensao}`,
      type: tipo,
    } as unknown as Blob
  );

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}/recibos/ler`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: corpo,
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }

  const texto = await resposta.text();
  let json: RespostaRecibo;
  try {
    json = JSON.parse(texto) as RespostaRecibo;
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!resposta.ok) {
    throw new Error(json.message ?? json.mensagem ?? "Não foi possível ler o recibo.");
  }
  return json.data;
}
