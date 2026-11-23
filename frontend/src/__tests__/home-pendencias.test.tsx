import { act } from "react";
import { createRoot, type Root, type TestInstance } from "test-renderer";
import {
  dashboardApi,
  despesasPessoaisApi,
  gruposApi,
  notificacoesApi,
} from "@/services/api";
import { useUsuario } from "@/contexts/UsuarioContext";
import Home from "../app/(main)/home";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Image: "Image",
  Modal: "Modal",
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("expo-router", () => ({
  Redirect: "Redirect",
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(
      callback,
      [callback],
    ),
}));

jest.mock("@/services/api", () => ({
  dashboardApi: {
    obter: jest.fn(),
    pendencias: jest.fn(),
  },
  despesasPessoaisApi: { listar: jest.fn() },
  gruposApi: { listar: jest.fn() },
  notificacoesApi: { listar: jest.fn() },
}));

jest.mock("@/contexts/UsuarioContext", () => ({
  useUsuario: jest.fn(),
}));

jest.mock("@/hooks/useCategoriasFinanceiras", () => ({
  useCategoriasFinanceiras: () => ({ categorias: [] }),
}));

jest.mock("@/hooks/useAppTheme", () => ({
  useAppTheme: () =>
    jest.requireActual<typeof import("@/constants/Cores")>(
      "@/constants/Cores",
    ).Cores,
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

function textContent(instance: TestInstance): string {
  return instance.children
    .map((child) =>
      typeof child === "string" ? child : textContent(child),
    )
    .join("");
}

describe("pendências do dashboard", () => {
  let root: Root | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUsuario).mockReturnValue({
      usuario: {
        id: "1",
        nome: "Usuária",
        email: "usuario@example.com",
        telefone: "",
        iniciais: "U",
        saldoTotal: 5,
      },
      carregando: false,
      erroRestauracao: null,
      restaurarSessao: jest.fn(async () => {}),
      login: jest.fn(async () => {}),
      logout: jest.fn(async () => {}),
      atualizarPerfil: jest.fn(),
      atualizarSaldoTotal: jest.fn(),
    });
    jest.mocked(dashboardApi.obter).mockResolvedValue({
      status: "success",
      data: {
        receber: 50,
        pagar: 45,
        total_grupos: 2,
        total_gasto_grupos: 0,
        total_gasto_pessoal: 0,
        total_gasto_geral: 0,
        total_despesas_grupos: 0,
        lembretes_proximos: [],
      },
    });
    jest.mocked(dashboardApi.pendencias).mockResolvedValue({
      status: "success",
      data: {
        a_receber: [
          {
            pessoa_id: 2,
            pessoa_nome: "Ana Souza",
            pessoa_avatar_url: "data:image/png;base64,ZmFrZQ==",
            grupo_id: 3,
            grupo_nome: "Casa",
            valor: 30,
          },
          {
            pessoa_id: 2,
            pessoa_nome: "Ana Souza",
            grupo_id: 4,
            grupo_nome: "Viagem",
            valor: 20,
          },
        ],
        a_pagar: [
          {
            pessoa_id: 3,
            pessoa_nome: "João Lima",
            grupo_id: 5,
            grupo_nome: "Reforma",
            valor: 45,
          },
        ],
      },
    });
    const paginacaoVazia = {
      limit: 3,
      offset: 0,
      total: 0,
      has_more: false,
    };
    jest.mocked(gruposApi.listar).mockResolvedValue({
      status: "success",
      data: [],
      paginacao: paginacaoVazia,
    });
    jest.mocked(despesasPessoaisApi.listar).mockResolvedValue({
      status: "success",
      data: [],
      paginacao: {
        ...paginacaoVazia,
        categorias: [],
        valor_total: 0,
      },
    });
    jest.mocked(notificacoesApi.listar).mockResolvedValue({
      status: "success",
      data: [],
      paginacao: { ...paginacaoVazia, limit: 1 },
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = undefined;
    }
  });

  async function renderHome() {
    const currentRoot = createRoot({ textComponentTypes: ["Text"] });
    root = currentRoot;
    await act(async () => {
      currentRoot.render(<Home />);
    });
    return currentRoot;
  }

  it("shows grouped debtors when opening the receivables indicator", async () => {
    const currentRoot = await renderHome();
    const button = currentRoot.container.queryAll(
      (instance) => instance.props.testID === "receivables-pill",
    )[0];
    if (!button) throw new Error("Indicador de valores a receber não encontrado");

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    expect(dashboardApi.pendencias).toHaveBeenCalledTimes(1);
    expect(currentRoot.container.queryAll(
      (instance) => instance.type === "Image",
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({
        props: {
          accessibilityLabel: "Foto de Ana Souza",
          source: { uri: "data:image/png;base64,ZmFrZQ==" },
          style: expect.anything(),
        },
      }),
    ]));
    expect(currentRoot.container.queryAll(
      (instance) => instance.type === "Text",
    ).map(textContent)).toEqual(expect.arrayContaining([
      "Quem deve a você",
      "Ana Souza",
      "Casa · R$ 30,00",
      "Viagem · R$ 20,00",
      "R$ 50,00",
    ]));
  });

  it("shows creditors when opening the payables indicator", async () => {
    const currentRoot = await renderHome();
    const button = currentRoot.container.queryAll(
      (instance) => instance.props.testID === "payables-pill",
    )[0];
    if (!button) throw new Error("Indicador de valores a pagar não encontrado");

    await act(async () => {
      button.props.onPress();
      await Promise.resolve();
    });

    expect(currentRoot.container.queryAll(
      (instance) => instance.type === "Text",
    ).map(textContent)).toEqual(expect.arrayContaining([
      "A quem você deve",
      "João Lima",
      "JL",
      "Reforma · R$ 45,00",
      "R$ 45,00",
    ]));
  });
});
