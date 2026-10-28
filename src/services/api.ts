import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  DespesaGrupo,
  DespesaPessoal,
  Dashboard,
  PagamentoGrupo,
  Grupo,
  Participante,
  ResumoPessoal,
  ResumoSaldosGrupo,
} from "@/types/api";

export type {
  ApiResponse,
  DespesaGrupo,
  DespesaPessoal,
  DivisaoDespesa,
  Grupo,
  Participante,
  ResumoPessoal,
  SaldoGrupo,
  Dashboard,
  DividaSimplificada,
  PagamentoGrupo,
} from "@/types/api";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:5000/api";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("@wepay:token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }

  const texto = await response.text();
  let json: { message?: string } & T;

  try {
    json = JSON.parse(texto) as { message?: string } & T;
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!response.ok) {
    throw new Error(json.message || "Erro na requisição.");
  }

  return json;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  status: string;
  data: {
    token: string;
    refresh_token: string;
    user: { id: number; nome: string; email: string };
  };
}

export interface RegisterResponse {
  status: string;
  mensagem: string;
}

export interface PerfilResponse {
  status: string;
  data: { id: number; nome: string; email: string; telefone?: string };
}

export const authApi = {
  login: (email: string, senha: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    }),

  register: (nome: string, email: string, senha: string) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha }),
    }),

  me: () => request<PerfilResponse>("/auth/me"),

  logout: (refresh_token: string) =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  refresh: (refresh_token: string) =>
    request<{ data: { token: string; refresh_token: string } }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  esqueciSenha: (email: string) =>
    request("/auth/esqueci-senha", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  redefinirSenha: (token: string, nova_senha: string) =>
    request<{ status: string; message?: string }>("/auth/redefinir-senha", {
      method: "POST",
      body: JSON.stringify({ token, nova_senha }),
    }),

  atualizarPerfil: (dados: { nome: string; email: string; telefone?: string }) =>
    request<{ status: string; message?: string }>("/auth/atualizar", {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  alterarSenha: (senha_atual: string, nova_senha: string) =>
    request<{ status: string; message?: string }>("/auth/alterar-senha", {
      method: "PUT",
      body: JSON.stringify({ senha_atual, nova_senha }),
    }),
};

// ─── Despesas Pessoais ────────────────────────────────────────────────────────

export interface DespesaPessoalResponse {
  status: string;
  data: DespesaPessoal | DespesaPessoal[];
}

export const despesasPessoaisApi = {
  listar: (params?: { categoria?: string; tipo?: string; data_inicio?: string; data_fim?: string }) => {
    const query = new URLSearchParams();
    if (params?.categoria) query.append("categoria", params.categoria);
    if (params?.tipo) query.append("tipo", params.tipo);
    if (params?.data_inicio) query.append("data_inicio", params.data_inicio);
    if (params?.data_fim) query.append("data_fim", params.data_fim);
    const qs = query.toString();
    return request<{ status: string; data: DespesaPessoal[] }>(`/despesas-pessoais${qs ? "?" + qs : ""}`);
  },

  buscar: (id: number) =>
    request<{ status: string; data: DespesaPessoal }>(`/despesas-pessoais/${id}`),

  criar: (dados: {
    descricao: string;
    valor: number;
    categoria?: string;
    tipo: "despesa" | "receita";
    data_despesa: string;
  }) =>
    request<{ status: string; data: { id: number } }>("/despesas-pessoais", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  atualizar: (id: number, dados: {
    descricao: string;
    valor: number;
    categoria?: string;
    tipo: "despesa" | "receita";
    data_despesa: string;
  }) =>
    request<{ status: string }>(`/despesas-pessoais/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  deletar: (id: number) =>
    request<{ status: string }>(`/despesas-pessoais/${id}`, {
      method: "DELETE",
    }),

  totalMes: (ano?: number, mes?: number) => {
    const query = new URLSearchParams();
    if (ano) query.append("ano", String(ano));
    if (mes) query.append("mes", String(mes));
    return request<{ status: string; data: ResumoPessoal }>(`/despesas-pessoais/total-mes?${query.toString()}`);
  },
};

// ─── Grupos ───────────────────────────────────────────────────────────────────

export const gruposApi = {
  listar: () =>
    request<{ status: string; data: Grupo[] }>("/grupos"),

  buscar: (id: number) =>
    request<{ status: string; data: Grupo }>(`/grupos/${id}`),

  criar: (dados: { nome: string; descricao?: string; participantes?: number[] }) =>
    request<{ status: string; data: { id: number } }>("/grupos", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  atualizar: (id: number, dados: { nome: string; descricao?: string }) =>
    request<{ status: string }>(`/grupos/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  deletar: (id: number) =>
    request<{ status: string }>(`/grupos/${id}`, { method: "DELETE" }),
};

// ─── Participantes ────────────────────────────────────────────────────────────

export const participantesApi = {
  listar: (grupoId: number) =>
    request<{ status: string; data: Participante[] }>(`/participantes/grupo/${grupoId}`),

  buscar: (id: number) =>
    request<{ status: string; data: Participante & { usuario?: { nome: string; email: string } } }>(`/participantes/${id}`),

  atualizar: (id: number, papel: "admin" | "participante") =>
    request<{ status: string }>(`/participantes/${id}`, { method: "PUT", body: JSON.stringify({ papel }) }),

  remover: (id: number) =>
    request<{ status: string }>(`/participantes/${id}`, { method: "DELETE" }),

  convidar: (grupo_id: number, email: string) =>
    request<{ status: string; message?: string }>('/participantes/convite', {
      method: "POST", body: JSON.stringify({ grupo_id, email }),
    }),

  aceitarConvite: (token: string) =>
    request<{ status: string; message?: string }>("/participantes/convite/aceitar", {
      method: "POST", body: JSON.stringify({ token }),
    }),
};

// ─── Despesas de Grupo ────────────────────────────────────────────────────────

export const despesasGrupoApi = {
  listar: (grupoId: number) =>
    request<{ status: string; data: DespesaGrupo[] }>(`/despesas/grupo/${grupoId}`),

  buscar: (id: number) =>
    request<{ status: string; data: DespesaGrupo }>(`/despesas/${id}`),

  criar: (dados: {
    grupo_id: number;
    descricao: string;
    valor: number;
    data_despesa: string;
    categoria?: string;
    pagador_id: number;
    participantes?: number[];
    divisao_tipo?: "igual" | "porcentagem" | "valores";
    percentuais?: Record<string, number>;
    valores?: Record<string, number>;
  }) =>
    request<{ status: string; data: { id: number } }>("/despesas", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  atualizar: (id: number, dados: {
    descricao: string;
    valor: number;
    data_despesa: string;
    categoria?: string;
    pagador_id: number;
    participantes?: number[];
    divisao_tipo?: "igual" | "porcentagem" | "valores";
    percentuais?: Record<string, number>;
    valores?: Record<string, number>;
  }) =>
    request<{ status: string }>(`/despesas/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  deletar: (id: number) =>
    request<{ status: string }>(`/despesas/${id}`, { method: "DELETE" }),
};

export const dashboardApi = {
  obter: () => request<{ status: string; data: Dashboard }>("/dashboard"),
};

export const saldosApi = {
  obter: (grupoId: number) =>
    request<{ status: string; data: ResumoSaldosGrupo }>(`/saldos/grupo/${grupoId}`),
};

export const pagamentosApi = {
  listar: (grupoId: number) =>
    request<{ status: string; data: PagamentoGrupo[] }>(`/pagamentos/grupo/${grupoId}`),
  criar: (dados: {
    grupo_id: number;
    recebedor_id: number;
    valor: number;
    data_pagamento?: string;
    metodo?: string;
    observacao?: string;
  }) =>
    request<{ status: string; data: { id: number } }>("/pagamentos", {
      method: "POST",
      body: JSON.stringify(dados),
    }),
};

export default request;
