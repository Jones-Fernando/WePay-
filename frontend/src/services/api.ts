import {
  expireSession,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "@/services/authSession";
import { API_BASE_URL, API_ENABLED } from "@/services/apiConfig";
import {
  API_REQUEST_TIMEOUT_MS,
  ApiTimeoutError,
  getAbortError,
} from "@/services/apiRequestErrors";
import { showFeedback } from "@/services/feedback";
import { Platform } from "react-native";
import type {
  DespesaGrupo,
  DespesaPessoal,
  Dashboard,
  PendenciasDashboard,
  PagamentoGrupo,
  Grupo,
  Participante,
  Paginacao,
  PaginacaoLista,
  ResumoPessoal,
  ResumoSaldosGrupo,
  Categoria,
  CategoriaIconeUsuario,
  GrupoIconeCapa,
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
  PendenciaDashboard,
  PendenciasDashboard,
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

const ROTAS_CRUD = [
  "/categorias",
  "/despesas-pessoais",
  "/grupos",
  "/participantes",
  "/despesas",
  "/pagamentos",
  "/auth/avatar",
];

function isCrudRoute(path: string): boolean {
  const pathname = path.split("?", 1)[0].replace(/\/+$/, "");
  if (pathname.startsWith("/participantes/convite")) return false;

  return (
    ROTAS_CRUD.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
    || ["/auth/register", "/auth/me", "/auth/atualizar", "/auth/delete"]
      .includes(pathname)
  );
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export { API_REQUEST_TIMEOUT_MS, ApiTimeoutError };

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    signal,
    timeoutMs = API_REQUEST_TIMEOUT_MS,
    ...requestOptions
  } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs deve ser um número maior que zero.");
  }

  if (!API_ENABLED) {
    throw new Error(
      "O backend do WEPAY ainda não está disponível. O acesso às funcionalidades será liberado após a publicação do servidor.",
    );
  }

  if (signal?.aborted) throw getAbortError(signal);

  const controller = new AbortController();
  let timedOut = false;
  const handleCallerAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", handleCallerAbort, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const token = await getAccessToken();
    const logoutPushToken =
      path === "/auth/logout" && typeof requestOptions.body === "string"
        ? (JSON.parse(requestOptions.body) as { expo_push_token?: string })
            .expo_push_token
        : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(requestOptions.headers as Record<string, string>),
    };

    const send = async (accessToken: string | null) => {
      const requestHeaders = { ...headers };
      if (accessToken) {
        requestHeaders["Authorization"] = `Bearer ${accessToken}`;
      }
      const fetchOptions =
        path === "/auth/logout" && accessToken !== token && accessToken
          ? {
              ...requestOptions,
              body: JSON.stringify({
                refresh_token: await getRefreshToken(),
                ...(logoutPushToken ? { expo_push_token: logoutPushToken } : {}),
              }),
            }
          : requestOptions;

      try {
        return await fetch(`${API_BASE_URL}${path}`, {
          ...fetchOptions,
          credentials: Platform.OS === "web" ? "include" : fetchOptions.credentials,
          headers: requestHeaders,
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new ApiTimeoutError(timeoutMs);
        if (signal?.aborted) throw getAbortError(signal);
        throw new Error("Não foi possível conectar ao servidor.");
      }
    };

    let response = await send(token);
    const shouldRefresh = !ROTAS_SEM_RENOVACAO.some((route) =>
      path.startsWith(route)
    );
    if (response.status === 401 && shouldRefresh) {
      const renewedToken = await refreshAccessToken({
        signal: controller.signal,
        timeoutMs,
      });
      if (renewedToken) {
        response = await send(renewedToken);
        if (response.status === 401) await expireSession();
      }
    }

    const texto = await response.text();
    let json: { message?: string; mensagem?: string } & T;

    try {
      json = JSON.parse(texto) as { message?: string; mensagem?: string } & T;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }

    if (!response.ok) {
      throw new ApiError(
        json.message || json.mensagem || "Erro na requisição.",
        response.status,
      );
    }

    const method = (requestOptions.method ?? "GET").toUpperCase();
    if (isCrudRoute(path) && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      const mensagemSucesso = json.message?.trim() || json.mensagem?.trim();
      showFeedback(
        "success",
        mensagemSucesso
          ? mensagemSucesso.replace(/[.!?]+$/, "")
          : "Operação concluída",
        mensagemSucesso ? "" : "A operação foi concluída com sucesso.",
      );
    }

    return json;
  } catch (erro) {
    const requestError = timedOut
      ? new ApiTimeoutError(timeoutMs)
      : signal?.aborted
        ? getAbortError(signal)
        : erro;
    if (isCrudRoute(path) && !signal?.aborted) {
      showFeedback(
        "error",
        "Não foi possível concluir",
        requestError instanceof Error
          ? requestError.message
          : "Ocorreu um erro inesperado.",
      );
    }
    throw requestError;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleCallerAbort);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  status: string;
  data: {
    token: string;
    refresh_token?: string;
    user: {
      id: number;
      nome: string;
      email: string;
      saldo_total: number;
      avatar_url?: string | null;
      pix_chave?: string | null;
    };
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
    avatar_url?: string | null;
    pix_chave?: string | null;
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

  atualizarPerfil: (dados: {
    nome: string;
    email: string;
    telefone?: string;
    pix_chave?: string | null;
  }) =>
    request<{ status: string; message?: string }>("/auth/atualizar", {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  atualizarAvatar: (imagemBase64: string) =>
    request<{
      status: string;
      data: { avatar_url: string };
      message?: string;
      mensagem?: string;
    }>("/auth/avatar", {
      method: "PUT",
      body: JSON.stringify({ imagem_base64: imagemBase64 }),
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

  listarIcones: (tipo?: "pessoal" | "grupo") => {
    const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
    return request<{ status: string; data: CategoriaIconeUsuario[] }>(
      `/categorias/icones${query}`,
    );
  },

  atualizarIconePadrao: (
    nome: string,
    tipo: "pessoal" | "grupo",
    icone: string,
  ) =>
    request<{ status: string }>("/categorias/icones", {
      method: "PUT",
      body: JSON.stringify({ nome, tipo, icone }),
    }),

  restaurarIconePadrao: (nome: string, tipo: "pessoal" | "grupo") => {
    const query = new URLSearchParams({ nome, tipo }).toString();
    return request<{ status: string }>(`/categorias/icones?${query}`, {
      method: "DELETE",
    });
  },

  criar: (
    nome: string,
    tipo: "pessoal" | "grupo" | "ambos" = "ambos",
    icone = "📌",
  ) =>
    request<{ status: string; data: { id: number } }>("/categorias", {
      method: "POST",
      body: JSON.stringify({ nome, tipo, icone }),
    }),

  atualizar: (
    id: number,
    nome: string,
    tipo: "pessoal" | "grupo" | "ambos" = "ambos",
    icone = "📌",
  ) =>
    request<{ status: string }>(`/categorias/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nome, tipo, icone }),
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

  marcarTodasLidas: () =>
    request<{ status: string; data: { atualizadas: number } }>(
      "/notificacoes/ler-todas",
      { method: "PUT" },
    ),

  obterPreferencias: () =>
    request<{
      status: string;
      data: {
        notificacoes: boolean;
        sons: boolean;
        despesas: boolean;
        cobrancas: boolean;
      };
    }>("/notificacoes/preferencias"),

  atualizarPreferencias: (preferencias: {
    notificacoes: boolean;
    som: boolean;
    despesas: boolean;
    cobrancas: boolean;
  }) =>
    request("/notificacoes/preferencias", {
      method: "PUT",
      body: JSON.stringify({
        notificacoes: preferencias.notificacoes,
        sons: preferencias.som,
        despesas: preferencias.despesas,
        cobrancas: preferencias.cobrancas,
      }),
    }),

  cobrar: (grupoId: number, devedorId: number) =>
    request<{ status: string; data: { id: number; valor: string }; message?: string }>(
      `/notificacoes/grupos/${grupoId}/cobrar`,
      {
        method: "POST",
        body: JSON.stringify({ devedor_id: devedorId }),
      },
    ),

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

  criar: (dados: {
    nome: string;
    descricao?: string;
    icone?: string | null;
    participantes?: number[];
  }) =>
    request<{ status: string; data: { id: number } }>("/grupos", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  atualizar: (id: number, dados: {
    nome: string;
    descricao?: string;
    icone?: string | null;
  }) =>
    request<{ status: string }>(`/grupos/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  deletar: (id: number) =>
    request<{ status: string }>(`/grupos/${id}`, { method: "DELETE" }),

  listarIconesCapa: () =>
    request<{
      status: string;
      data: { icones: GrupoIconeCapa[]; ocultos: string[] };
    }>(
      "/grupos/icones-capa",
    ),

  criarIconeCapa: (nome: string, icone: string) =>
    request<{ status: string; data: { id: string } }>("/grupos/icones-capa", {
      method: "POST",
      body: JSON.stringify({ nome, icone }),
    }),

  atualizarIconeCapa: (id: string, nome: string, icone: string) =>
    request<{ status: string }>(
      `/grupos/icones-capa/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ nome, icone }),
      },
    ),

  excluirIconeCapa: (id: string) =>
    request<{ status: string }>(
      `/grupos/icones-capa/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  restaurarCatalogoIconesCapa: () =>
    request<{ status: string }>("/grupos/icones-capa/restaurar", {
      method: "POST",
    }),

  atualizarIconesCapa: (ocultos: string[]) =>
    request<{ status: string }>("/grupos/icones-capa", {
      method: "PUT",
      body: JSON.stringify({ ocultos }),
    }),

  restaurarIconesCapa: () =>
    request<{ status: string }>("/grupos/icones-capa", {
      method: "DELETE",
    }),
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
  pendencias: () =>
    request<{ status: string; data: PendenciasDashboard }>(
      "/dashboard/pendencias",
    ),
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
  }, idempotencyKey: string) =>
    request<{ status: string; data: { id: number } }>("/pagamentos", {
      method: "POST",
      body: JSON.stringify(dados),
      headers: { "Idempotency-Key": idempotencyKey },
    }),
};

export default request;
