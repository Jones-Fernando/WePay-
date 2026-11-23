import { act } from "react";
import { createRoot, type Root } from "test-renderer";
import { useUsuario } from "@/contexts/UsuarioContext";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import Configuracoes from "../app/(main)/configuracoes";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Modal: "Modal",
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Switch: "Switch",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("expo-router", () => ({
  Link: "Link",
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock("@/contexts/UsuarioContext", () => ({
  useUsuario: jest.fn(),
}));

jest.mock("@/contexts/PreferenciasContext", () => ({
  usePreferencias: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  authApi: { excluirConta: jest.fn() },
}));

jest.mock("@/services/feedback", () => ({
  Alert: { alert: jest.fn() },
}));

jest.mock("@/components/external-link", () => ({
  ExternalLink: "Text",
}));

jest.mock("@/hooks/useAppTheme", () => ({
  useAppTheme: () =>
    jest.requireActual<typeof import("@/constants/Cores")>(
      "@/constants/Cores",
    ).Cores,
}));

describe("controles de notificações nas Configurações", () => {
  let root: Root | undefined;
  const atualizar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUsuario).mockReturnValue({
      usuario: null,
      carregando: false,
      erroRestauracao: null,
      restaurarSessao: jest.fn(async () => {}),
      login: jest.fn(async () => {}),
      logout: jest.fn(async () => {}),
      atualizarPerfil: jest.fn(),
      atualizarSaldoTotal: jest.fn(),
    });
    jest.mocked(usePreferencias).mockReturnValue({
      preferencias: {
        notificacoes: true,
        som: false,
        despesas: true,
        cobrancas: false,
        tema: "Sistema",
      },
      carregando: false,
      atualizar,
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = undefined;
    }
  });

  it("maps each switch to its own notification preference", async () => {
    const currentRoot = createRoot({ textComponentTypes: ["Text"] });
    root = currentRoot;
    await act(async () => {
      currentRoot.render(<Configuracoes />);
    });

    const switches = currentRoot.container.queryAll(
      (instance) => instance.type === "Switch",
    );
    expect(switches.map((item) => item.props.value)).toEqual([
      true,
      false,
      true,
      false,
    ]);

    act(() => {
      switches[0].props.onValueChange(false);
      switches[1].props.onValueChange(true);
      switches[2].props.onValueChange(false);
      switches[3].props.onValueChange(true);
    });

    expect(atualizar.mock.calls).toEqual([
      [{ despesas: false }],
      [{ cobrancas: true }],
      [{ notificacoes: false }],
      [{ som: true }],
    ]);
  });

  it("disables notification switches while preferences are loading", async () => {
    jest.mocked(usePreferencias).mockReturnValue({
      preferencias: {
        notificacoes: false,
        som: true,
        despesas: false,
        cobrancas: true,
        tema: "Sistema",
      },
      carregando: true,
      atualizar,
    });

    const currentRoot = createRoot({ textComponentTypes: ["Text"] });
    root = currentRoot;
    await act(async () => {
      currentRoot.render(<Configuracoes />);
    });

    const switches = currentRoot.container.queryAll(
      (instance) => instance.type === "Switch",
    );
    expect(switches).toHaveLength(4);
    expect(switches.every((item) => item.props.disabled)).toBe(true);
  });
});
