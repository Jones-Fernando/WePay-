import {
  authApi,
  categoriasApi,
  gruposApi,
  notificacoesApi,
  pagamentosApi,
  participantesApi,
  request,
} from "@/services/api";
import { Platform } from "react-native";
import { subscribeFeedback } from "@/services/feedback";
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

describe("authApi.excluirConta", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        message: "Conta excluida com sucesso.",
      }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the account password using DELETE", async () => {
    await authApi.excluirConta("SenhaAtual123!");

    const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toMatch(/\/auth\/delete$/);
    expect(options?.method).toBe("DELETE");
    expect(JSON.parse(String(options?.body))).toEqual({
      senha_atual: "SenhaAtual123!",
    });
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

    it("marks all notifications as read", async () => {
      await notificacoesApi.marcarTodasLidas();

      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(expect.stringMatching(/\/notificacoes\/ler-todas$/));
      expect(options?.method).toBe("PUT");
    });

    it("sends a private balance reminder to the selected debtor", async () => {
      await notificacoesApi.cobrar(21, 8);

      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(
        expect.stringMatching(/\/notificacoes\/grupos\/21\/cobrar$/),
      );
      expect(options?.method).toBe("POST");
      expect(JSON.parse(String(options?.body))).toEqual({ devedor_id: 8 });
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

  it("manages per-user icons for standard categories", async () => {
    await categoriasApi.listarIcones("pessoal");
    await categoriasApi.atualizarIconePadrao("Casa", "pessoal", "🛋️");
    await categoriasApi.restaurarIconePadrao("Casa", "pessoal");

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][0]).toEqual(
      expect.stringMatching(/\/categorias\/icones\?tipo=pessoal$/),
    );
    expect(calls[1][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      nome: "Casa",
      tipo: "pessoal",
      icone: "🛋️",
    });
    expect(calls[2][0]).toEqual(
      expect.stringMatching(/\/categorias\/icones\?nome=Casa&tipo=pessoal$/),
    );
    expect(calls[2][1]?.method).toBe("DELETE");
  });

  it("sends typed category create and update payloads", async () => {
    await categoriasApi.criar("Viagem", "pessoal", "✈️");
    await categoriasApi.atualizar(12, "Viagens", "pessoal", "🧳");

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      nome: "Viagem",
      tipo: "pessoal",
      icone: "✈️",
    });
    expect(calls[1][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      nome: "Viagens",
      tipo: "pessoal",
      icone: "🧳",
    });
  });

  it("deletes a category by ID", async () => {
    await categoriasApi.deletar(12);

    const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringMatching(/\/categorias\/12$/));
    expect(options?.method).toBe("DELETE");
  });
});

describe("API operation feedback", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the specific server message as the CRUD success title", async () => {
    const notifications: {
      type: string;
      title: string;
      message: string;
    }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 201,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        message: "Categoria criada.",
      }),
    } as Response);

    try {
      await categoriasApi.criar("Viagem", "pessoal");
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "success",
          title: "Categoria criada",
          message: "",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("uploads a profile avatar and reports its successful update", async () => {
    const notifications: {
      type: string;
      title: string;
      message: string;
    }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        message: "Foto de perfil atualizada com sucesso.",
        data: { avatar_url: "data:image/jpeg;base64,/9j/" },
      }),
    } as Response);

    try {
      await authApi.atualizarAvatar("/9j/");
      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(expect.stringMatching(/\/auth\/avatar$/));
      expect(options?.method).toBe("PUT");
      expect(JSON.parse(String(options?.body))).toEqual({
        imagem_base64: "/9j/",
      });
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "success",
          title: "Foto de perfil atualizada com sucesso",
          message: "",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("announces CRUD errors before propagating them to the screen", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 409,
      ok: false,
      text: async () => JSON.stringify({
        status: "erro",
        message: "O nome do grupo já está em uso.",
      }),
    } as Response);

    try {
      await expect(gruposApi.criar({ nome: "Viagem" }))
        .rejects.toMatchObject({
          message: "O nome do grupo já está em uso.",
          status: 409,
        });
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "error",
          message: "O nome do grupo já está em uso.",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("sends the selected cover icon when creating a group", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 201,
      ok: true,
      text: async () => JSON.stringify({
        status: "sucesso",
        data: { id: 12 },
      }),
    } as Response);

    await gruposApi.criar({ nome: "Viagem", icone: "✈️" });

    const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringMatching(/\/grupos$/));
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      nome: "Viagem",
      icone: "✈️",
    });
  });

  it("announces errors while reading CRUD data", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 503,
      ok: false,
      text: async () => JSON.stringify({
        status: "erro",
        message: "Não foi possível carregar os grupos.",
      }),
    } as Response);

    try {
      await expect(gruposApi.listar()).rejects.toMatchObject({ status: 503 });
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "error",
          message: "Não foi possível carregar os grupos.",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("does not announce success for login or participant invitations", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify({
          status: "sucesso",
          data: {
            token: "access-token",
            user: {
              id: 1,
              nome: "Teste",
              email: "teste@example.com",
              saldo_total: 0,
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        status: 201,
        ok: true,
        text: async () => JSON.stringify({
          status: "sucesso",
          message: "Convite enviado.",
        }),
      } as Response);

    try {
      await authApi.login("teste@example.com", "senha");
      await participantesApi.convidar(8, "pessoa@example.com");
      expect(notifications).toEqual([]);
    } finally {
      unsubscribe();
    }
  });
});

describe("API request timeout and cancellation", () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue("access-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports connection failures with a network-specific message", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    jest.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );

    try {
      await expect(request("/categorias")).rejects.toThrow(
        "Não foi possível conectar ao servidor.",
      );
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "error",
          message: "Não foi possível conectar ao servidor.",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("aborts requests at their configured timeout and reports a distinct message", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );

    try {
      await expect(request("/categorias", { timeoutMs: 20 })).rejects.toThrow(
        "A requisição excedeu o tempo limite de 20 ms.",
      );
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "error",
          message: "A requisição excedeu o tempo limite de 20 ms. Tente novamente.",
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("preserves screen cancellation without reporting it as a connection failure", async () => {
    const notifications: { type: string; message: string }[] = [];
    const unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
    const controller = new AbortController();
    jest.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );

    try {
      const pendingRequest = request("/categorias", {
        signal: controller.signal,
      });
      controller.abort();

      await expect(pendingRequest).rejects.toMatchObject({ name: "AbortError" });
      expect(notifications).toEqual([]);
    } finally {
      unsubscribe();
    }
  });

  it("applies the request timeout while renewing an expired session", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ message: "Unauthorized" }),
    } as Response);
    mockRefreshAccessToken.mockImplementation(
      ({ signal }: { signal?: AbortSignal } = {}) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );

    await expect(request("/grupos", { timeoutMs: 20 })).rejects.toMatchObject({
      name: "ApiTimeoutError",
      message: expect.stringContaining("20 ms"),
    });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 20, signal: expect.anything() }),
    );
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

  it("manages hidden group-cover icons", async () => {
    await gruposApi.listarIconesCapa();
    await gruposApi.atualizarIconesCapa(["✈️", "🏠"]);
    await gruposApi.restaurarIconesCapa();

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][0]).toEqual(expect.stringMatching(/\/grupos\/icones-capa$/));
    expect(calls[1][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      ocultos: ["✈️", "🏠"],
    });
    expect(calls[2][1]?.method).toBe("DELETE");
  });

  it("creates, edits, deletes, and restores group-cover icon options", async () => {
    await gruposApi.criarIconeCapa("Férias", "🏖️");
    await gruposApi.atualizarIconeCapa("personalizado:abc", "Viagem", "✈️");
    await gruposApi.excluirIconeCapa("personalizado:abc");
    await gruposApi.restaurarCatalogoIconesCapa();

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][0]).toEqual(expect.stringMatching(/\/grupos\/icones-capa$/));
    expect(calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      nome: "Férias",
      icone: "🏖️",
    });
    expect(calls[1][0]).toEqual(
      expect.stringMatching(/\/grupos\/icones-capa\/personalizado%3Aabc$/),
    );
    expect(calls[1][1]?.method).toBe("PUT");
    expect(calls[2][1]?.method).toBe("DELETE");
    expect(calls[3][0]).toEqual(
      expect.stringMatching(/\/grupos\/icones-capa\/restaurar$/),
    );
    expect(calls[3][1]?.method).toBe("POST");
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

  it("sends the idempotency key when creating a payment", async () => {
    const key = "c1b48325-4c06-4b2c-a66c-ae019fc1765a";
    await pagamentosApi.criar(
      { grupo_id: 12, recebedor_id: 5, valor: 15 },
      key,
    );

    const [, options] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(options?.headers).toMatchObject({ "Idempotency-Key": key });
  });
});
