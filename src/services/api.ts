import AsyncStorage from "@react-native-async-storage/async-storage";

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

// ─── Auth ────────────────────────────────────────────────────────────────────

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
};

export default request;
