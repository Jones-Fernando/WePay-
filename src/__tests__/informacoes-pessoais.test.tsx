import { act } from "react";
import { createRoot, type Root, type TestInstance } from "test-renderer";
import { router } from "expo-router";
import { useUsuario } from "@/contexts/UsuarioContext";
import { authApi } from "@/services/api";
import GerenciamentoPerfilScreen from "../app/(main)/gerenciamento-perfil";
import InformacoesPessoaisScreen from "../app/(main)/informacoes-pessoais";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Image: "Image",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "web" },
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/contexts/UsuarioContext", () => ({
  useUsuario: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  authApi: {
    atualizarAvatar: jest.fn(),
    atualizarPerfil: jest.fn(),
  },
}));

jest.mock("@/services/feedback", () => ({
  Alert: { alert: jest.fn() },
}));

jest.mock("@/hooks/useAppTheme", () => ({
  useAppTheme: () =>
    jest.requireActual<typeof import("@/constants/Cores")>(
      "@/constants/Cores",
    ).Cores,
}));

function findInput(root: Root, placeholder: string): TestInstance {
  const input = root.container.queryAll(
    (instance) =>
      instance.type === "TextInput"
      && instance.props.placeholder === placeholder,
  )[0];
  if (!input) throw new Error(`Campo não encontrado: ${placeholder}`);
  return input;
}

function textContent(instance: TestInstance): string {
  return instance.children
    .map((child) =>
      typeof child === "string" ? child : textContent(child),
    )
    .join("");
}

describe("Informações pessoais", () => {
  let root: Root | undefined;
  const usuario = {
    id: "1",
    nome: "Maria da Silva",
    email: "maria@example.com",
    telefone: "11999999999",
    pixChave: "maria@example.com",
    iniciais: "MS",
    saldoTotal: 0,
  };
  const atualizarPerfil = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUsuario).mockReturnValue({
      usuario,
      carregando: false,
      erroRestauracao: null,
      restaurarSessao: jest.fn(async () => {}),
      login: jest.fn(async () => {}),
      logout: jest.fn(async () => {}),
      atualizarPerfil,
      atualizarSaldoTotal: jest.fn(),
    });
    jest.mocked(authApi.atualizarPerfil).mockResolvedValue({
      status: "success",
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = undefined;
    }
  });

  it("groups profile options by category and opens personal information", async () => {
    const currentRoot = createRoot({ textComponentTypes: ["Text"] });
    root = currentRoot;
    await act(async () => {
      currentRoot.render(<GerenciamentoPerfilScreen />);
    });

    const optionLabels = currentRoot.container.queryAll(
      (instance) =>
        instance.type === "Text"
        && [
          "Informações pessoais",
          "Alterar senha",
          "Configurações",
        ].includes(textContent(instance)),
    ).map(textContent);
    expect(optionLabels).toEqual([
      "Informações pessoais",
      "Alterar senha",
      "Configurações",
    ]);
    const categoryLabels = currentRoot.container.queryAll(
      (instance) =>
        instance.type === "Text"
        && ["Perfil", "Segurança", "Conta"].includes(textContent(instance)),
    ).map(textContent);
    expect(categoryLabels).toEqual(["Perfil", "Segurança", "Conta"]);

    const option = currentRoot.container.queryAll(
      (instance) => instance.props.testID === "personal-info-option",
    )[0];
    if (!option) throw new Error("Opção de informações pessoais não encontrada");

    act(() => option.props.onPress());
    expect(router.push).toHaveBeenCalledWith(
      "/(main)/informacoes-pessoais",
    );
  });

  it("saves personal fields and updates the current user", async () => {
    const currentRoot = createRoot({ textComponentTypes: ["Text"] });
    root = currentRoot;
    await act(async () => {
      currentRoot.render(<InformacoesPessoaisScreen />);
    });

    act(() =>
      findInput(currentRoot, "Digite seu nome").props.onChangeText("Ana Souza"),
    );
    act(() =>
      findInput(currentRoot, "seu@email.com").props.onChangeText("ana@example.com"),
    );
    act(() =>
      findInput(currentRoot, "Digite sua chave Pix").props.onChangeText("ana@example.com"),
    );

    const saveButton = currentRoot.container.queryAll(
      (instance) => instance.props.testID === "save-personal-info",
    )[0];
    if (!saveButton) throw new Error("Botão de salvar não encontrado");
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(authApi.atualizarPerfil).toHaveBeenCalledWith({
      nome: "Ana Souza",
      email: "ana@example.com",
      telefone: "11999999999",
      pix_chave: "ana@example.com",
    });
    expect(atualizarPerfil).toHaveBeenCalledWith({
      nome: "Ana Souza",
      email: "ana@example.com",
      pixChave: "ana@example.com",
    });
  });
});
