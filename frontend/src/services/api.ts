import {
  expireSession,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "@/services/authSession";
import { API_BASE_URL } from "@/services/apiConfig";
import { Platform } from "react-native";
import type {
  DespesaGrupo,
  DespesaPessoal,
  Dashboard,
  PagamentoGrupo,
  Grupo,
  Participante,
  Paginacao,
  PaginacaoLista,
  ResumoPessoal,
  ResumoSaldosGrupo,
  Categoria,
  Notificacao,
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
  Paginacao,
  PaginacaoLista,
  Categoria,
  Notificacao,
} from "@/types/api";

const ROTAS_SEM_RENOVACAO = [
  "/auth/login",
  "/auth/register",
  "/auth/cadastro",
  "/auth/esqueci-senha",
  "/auth/redefinir-senha",
  "/auth/refresh",
  "/usuarios/recover",
  "/usuarios/recuperar-senha",
  "/usuarios/recuperar-senha/confirmar",
];

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const logoutPushToken =
    path === "/auth/logout" && typeof options.body === "string"
      ? (JSON.parse(options.body) as { expo_push_token?: string })
          .expo_push_token
      : undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const send = async (accessToken: string | null) => {
    const requestHeaders = { ...headers };
    if (accessToken) {
      requestHeaders["Authorization"] = `Bearer ${accessToken}`;
    }
    const requestOptions =
      path === "/auth/logout" && accessToken !== token && accessToken
        ? {
            ...options,
            body: JSON.stringify({
              refresh_token: await getRefreshToken(),
              ...(logoutPushToken ? { expo_push_token: logoutPushToken } : {}),
            }),
          }
        : options;

    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...requestOptions,
        credentials: Platform.OS === "web" ? "include" : requestOptions.credentials,
        headers: requestHeaders,
      });
    } catch {
      throw new Error("Não foi possível conectar ao servidor.");
    }
  };

  let response = await send(token);
  const shouldRefresh = !ROTAS_SEM_RENOVACAO.some((route) =>
    path.startsWith(route)
  );
  if (response.status === 401 && shouldRefresh) {
    const renewedToken = await refreshAccessToken();
    if (renewedToken) {
      response = await send(renewedToken);
      if (response.status === 401) await expireSession();
    }
  }

  const texto = await response.text();
  let json: { message?: string } & T;

  try {
    json = JSON.parse(texto) as { message?: string } & T;
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!response.ok) {
    throw new ApiError(json.message || "Erro na requisição.", response.status);
  }

  return json;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  status: string;
  data: {
    token: string;
    refresh_token?: string;
    user: { id: number; nome: string; email: string; saldo_total: number };
  };
}

export interface RegisterResponse {
  status: string;
  mensagem?: string;
  message?: string;
}

export interface PerfilResponse {
  status: string;
  data: {
    id: number;
    nome: string;
    email: string;
    telefone?: string;
    saldo_total: number;
  };
}

export const authApi = {
  login: (email: string, senha: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha, ...(Platform.OS === "web" ? { web: true } : {}) }),
    }),

  register: (nome: string, email: string, senha: string, convite?: string) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha, convite }),
    }),

  me: () => request<PerfilResponse>("/auth/me"),

  excluirConta: (senha_atual: string) =>
    request<{ status: string; message?: string }>("/auth/delete", {
      method: "DELETE",
      body: JSON.stringify({ senha_atual }),
    }),

  logout: (refresh_token: string | null, expo_push_token?: string | null) =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({
        ...(refresh_token ? { refresh_token } : {}),
        ...(expo_push_token ? { expo_push_token } : {}),
      }),
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

export const categoriasApi = {
  listar: (tipo?: "pessoal" | "grupo" | "ambos") => {
    const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
    return request<{ status: string; data: Categoria[] }>(`/categorias${query}`);
  },

  criar: (nome: string, tipo: "pessoal" | "grupo" | "ambos" = "ambos") =>
    request<{ status: string; data: { id: number } }>("/categorias", {
      method: "POST",
      body: JSON.stringify({ nome, tipo }),
    }),

  atualizar: (
    id: number,
    nome: string,
    tipo: "pessoal" | "grupo" | "ambos" = "ambos",
  ) =>
    request<{ status: string }>(`/categorias/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nome, tipo }),
    }),

  deletar: (id: number) =>
    request<{ status: string }>(`/categorias/${id}`, { method: "DELETE" }),
};

export const notificacoesApi = {
  listar: (
    somenteNaoLidas = false,
    params?: { limit?: number; offset?: number },
  ) => {
    const query = new URLSearchParams();
    if (somenteNaoLidas) query.append("nao_lidas", "true");
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{ status: string; data: Notificacao[]; paginacao: Paginacao }>(
      `/notificacoes${qs ? `?${qs}` : ""}`,
    );
  },

  marcarLida: (id: number) =>
    request<{ status: string }>(`/notificacoes/${id}/ler`, {
      method: "PUT",
    }),

  obterPreferencias: () =>
    request<{
      status: string;
      data: { notificacoes: boolean; sons: boolean };
    }>("/notificacoes/preferencias"),

  atualizarPreferencias: (notificacoes: boolean, sons: boolean) =>
    request("/notificacoes/preferencias", {
      method: "PUT",
      body: JSON.stringify({ notificacoes, sons }),
    }),

  registrarDispositivo: (token: string, plataforma: "ios" | "android") =>
    request("/notificacoes/dispositivos", {
      method: "POST",
      body: JSON.stringify({ token, plataforma }),
    }),

  removerDispositivo: (token: string) =>
    request("/notificacoes/dispositivos", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),
};

// ─── Despesas Pessoais ────────────────────────────────────────────────────────

export interface DespesaPessoalResponse {
  status: string;
  data: DespesaPessoal | DespesaPessoal[];
}

export const despesasPessoaisApi = {
  listar: (params?: {
    categoria?: string;
    tipo?: string;
    data_inicio?: string;
    data_fim?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.categoria) query.append("categoria", params.categoria);
    if (params?.tipo) query.append("tipo", params.tipo);
    if (params?.data_inicio) query.append("data_inicio", params.data_inicio);
    if (params?.data_fim) query.append("data_fim", params.data_fim);
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{
      status: string;
      data: DespesaPessoal[];
      paginacao: PaginacaoLista;
    }>(`/despesas-pessoais${qs ? "?" + qs : ""}`);
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
  listar: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{ status: string; data: Grupo[]; paginacao: Paginacao }>(
      `/grupos${qs ? `?${qs}` : ""}`,
    );
  },

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
  listar: (grupoId: number, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{
      status: string;
      data: Participante[];
      paginacao: Paginacao;
    }>(`/participantes/grupo/${grupoId}${qs ? `?${qs}` : ""}`);
  },

  listarTodos: async (grupoId: number) => {
    const participantes: Participante[] = [];
    let offset = 0;
    let temMais = true;
    while (temMais) {
      const resposta = await participantesApi.listar(grupoId, { limit: 100, offset });
      participantes.push(...resposta.data);
      temMais = resposta.paginacao.has_more;
      offset += resposta.paginacao.limit;
    }
    return participantes;
  },

  buscar: (id: number) =>
    request<{
      status: string;
      data: Participante & {
        usuario?: { nome: string; email: string | null };
      };
    }>(`/participantes/${id}`),

  atualizar: (id: number, papel: "admin" | "participante") =>
    request<{ status: string }>(`/participantes/${id}`, { method: "PUT", body: JSON.stringify({ papel }) }),

  remover: (id: number) =>
    request<{ status: string }>(`/participantes/${id}`, { method: "DELETE" }),

  convidar: (grupo_id: number, email: string) =>
    request<{
      status: string;
      message?: string;
      mensagem?: string;
      data?: { email_enviado: boolean };
    }>('/participantes/convite', {
      method: "POST", body: JSON.stringify({ grupo_id, email }),
    }),

  aceitarConvite: (token: string) =>
    request<{ status: string; message?: string }>("/participantes/convite/aceitar", {
      method: "POST", body: JSON.stringify({ token }),
    }),
};

// ─── Despesas de Grupo ────────────────────────────────────────────────────────

export const despesasGrupoApi = {
  listar: (grupoId: number, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{
      status: string;
      data: DespesaGrupo[];
      paginacao: PaginacaoLista;
    }>(`/despesas/grupo/${grupoId}${qs ? `?${qs}` : ""}`);
  },

  buscar: (id: number) =>
    request<{ status: string; data: DespesaGrupo }>(`/despesas/${id}`),

  criar: (dados: {
    grupo_id: number;
    descricao: string;
    valor: number;
    data_despesa: string;
    categoria?: string;
    observacao?: string;
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
    observacao?: string | null;
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
  listar: (grupoId: number, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.append("limit", String(params.limit));
    if (params?.offset !== undefined) query.append("offset", String(params.offset));
    const qs = query.toString();
    return request<{
      status: string;
      data: PagamentoGrupo[];
      paginacao: Paginacao;
    }>(`/pagamentos/grupo/${grupoId}${qs ? `?${qs}` : ""}`);
  },
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
