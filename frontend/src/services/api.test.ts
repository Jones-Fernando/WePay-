import {
  authApi,
  categoriasApi,
  gruposApi,
  notificacoesApi,
  pagamentosApi,
  participantesApi,
} from "@/services/api";
import { Platform } from "react-native";
import {
  expireSession,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "@/services/authSession";

jest.mock("@/services/authSession", () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  expireSession: jest.fn(),
}));

const mockGetAccessToken = jest.mocked(getAccessToken);
const mockGetRefreshToken = jest.mocked(getRefreshToken);
const mockRefreshAccessToken = jest.mocked(refreshAccessToken);
const mockExpireSession = jest.mocked(expireSession);

describe("authApi.logout", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("old-access-token");
    mockGetRefreshToken.mockResolvedValue("rotated-refresh-token");
    mockRefreshAccessToken.mockResolvedValue("new-access-token");
    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ status: "sucesso" }),
      } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves the push token when retrying with a refreshed session", async () => {
    await authApi.logout("old-refresh-token", "expo-push-token");

    const retry = jest.mocked(globalThis.fetch).mock.calls[1][1];
    expect(JSON.parse(String(retry?.body))).toEqual({
      refresh_token: "rotated-refresh-token",
      expo_push_token: "expo-push-token",
    });
  });

  it("expires the session when a retried request is still unauthorized", async () => {
    jest.mocked(globalThis.fetch)
      .mockReset()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: "Unauthorized" }),
      } as Response);

    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(mockExpireSession).toHaveBeenCalledTimes(1);
  });
});

describe("categoriasApi", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ status: "sucesso", data: [] }),
    } as Response);
  });

  describe("web auth API", () => {
    it("requests a cookie-backed web session without persisting refresh tokens", async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
      mockGetAccessToken.mockResolvedValue(null);
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          status: "sucesso",
          data: {
            token: "access",
            user: {
              id: 1,
              nome: "Teste",
              email: "teste@example.com",
              saldo_total: 0,
            },
          },
        }),
      } as Response);
      try {
        await authApi.login("teste@example.com", "SenhaSegura123!");

        const [, options] = jest.mocked(globalThis.fetch).mock.calls[0];
        expect(options?.credentials).toBe("include");
        expect(JSON.parse(String(options?.body))).toEqual({
          email: "teste@example.com",
          senha: "SenhaSegura123!",
          web: true,
        });
      } finally {
        Object.defineProperty(Platform, "OS", {
          configurable: true,
          value: originalPlatform,
        });
        jest.restoreAllMocks();
      }
    });
  });

  describe("notificacoesApi", () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue("access-token");
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ status: "sucesso", data: [] }),
      } as Response);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("supports listing all notifications or only unread ones", async () => {
      await notificacoesApi.listar();
      await notificacoesApi.listar(true);
      await notificacoesApi.listar(true, { limit: 30, offset: 60 });

      const calls = jest.mocked(globalThis.fetch).mock.calls;
      expect(calls[0][0]).toEqual(expect.stringMatching(/\/notificacoes$/));
      expect(calls[1][0]).toEqual(
        expect.stringMatching(/\/notificacoes\?nao_lidas=true$/),
      );
      expect(calls[2][0]).toEqual(
        expect.stringMatching(/\/notificacoes\?nao_lidas=true&limit=30&offset=60$/),
      );
    });

    it("marks a notification as read", async () => {
      await notificacoesApi.marcarLida(27);

      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(expect.stringMatching(/\/notificacoes\/27\/ler$/));
      expect(options?.method).toBe("PUT");
    });

    it("removes a registered push device", async () => {
      await notificacoesApi.removerDispositivo("ExpoPushToken[device]");

      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(expect.stringMatching(/\/notificacoes\/dispositivos$/));
      expect(options?.method).toBe("DELETE");
      expect(JSON.parse(String(options?.body))).toEqual({
        token: "ExpoPushToken[device]",
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("filters categories by usage type", async () => {
    await categoriasApi.listar("pessoal");

    expect(jest.mocked(globalThis.fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/categorias\?tipo=pessoal$/),
    );
  });

  it("sends typed category create and update payloads", async () => {
    await categoriasApi.criar("Viagem", "pessoal");
    await categoriasApi.atualizar(12, "Viagens", "pessoal");

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      nome: "Viagem",
      tipo: "pessoal",
    });
    expect(calls[1][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      nome: "Viagens",
      tipo: "pessoal",
    });
  });

  it("deletes a category by ID", async () => {
    await categoriasApi.deletar(12);

    const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringMatching(/\/categorias\/12$/));
    expect(options?.method).toBe("DELETE");
  });
});

describe("group and participant pagination APIs", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        data: [],
        paginacao: { limit: 20, offset: 40, total: 45, has_more: false },
      }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests paginated groups and participants", async () => {
    await gruposApi.listar({ limit: 20, offset: 40 });
    await participantesApi.listar(12, { limit: 20, offset: 40 });

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][0]).toEqual(expect.stringMatching(/\/grupos\?limit=20&offset=40$/));
    expect(calls[1][0]).toEqual(
      expect.stringMatching(/\/participantes\/grupo\/12\?limit=20&offset=40$/),
    );
  });

  it("loads every participant page for operations that need the full group", async () => {
    jest.mocked(globalThis.fetch)
      .mockReset()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          status: "sucesso",
          data: [{ id: 1, usuario_id: 1 }],
          paginacao: { limit: 100, offset: 0, total: 101, has_more: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          status: "sucesso",
          data: [{ id: 2, usuario_id: 2 }],
          paginacao: { limit: 100, offset: 100, total: 101, has_more: false },
        }),
      } as Response);

    const participantes = await participantesApi.listarTodos(12);

    expect(participantes).toHaveLength(2);
    expect(jest.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(globalThis.fetch).mock.calls[1][0]).toEqual(
      expect.stringMatching(/\/participantes\/grupo\/12\?limit=100&offset=100$/),
    );
  });
});

describe("pagamentosApi", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        data: [],
        paginacao: { limit: 10, offset: 20, total: 25, has_more: false },
      }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a bounded payment-history page", async () => {
    await pagamentosApi.listar(12, { limit: 10, offset: 20 });

    expect(jest.mocked(globalThis.fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/pagamentos\/grupo\/12\?limit=10&offset=20$/),
    );
  });
});
