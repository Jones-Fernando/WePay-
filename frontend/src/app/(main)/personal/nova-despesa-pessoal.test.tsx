import { act } from "react";
import { Alert } from "react-native";
import { createRoot, type Root, type TestInstance } from "test-renderer";
import { router } from "expo-router";
import { despesasPessoaisApi } from "@/services/api";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import NovaDespesaPessoal from "./nova-despesa-pessoal";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Alert: { alert: jest.fn() },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "web" },
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  StatusBar: "StatusBar",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: jest.fn(({ onChange }) =>
    jest.requireActual<typeof import("react")>("react").createElement(
      "DateTimePicker",
      { onChange, testID: "date-picker" },
    ),
  ),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/services/api", () => ({
  despesasPessoaisApi: { criar: jest.fn() },
}));

jest.mock("@/hooks/useCategoriasFinanceiras", () => ({
  useCategoriasFinanceiras: jest.fn(),
}));

function findElement(
  root: Root,
  predicate: (instance: TestInstance) => boolean,
  description: string,
): TestInstance {
  const instance = root.container.queryAll(predicate)[0];
  if (!instance) throw new Error(`Elemento não encontrado: ${description}`);
  return instance;
}

function textContent(instance: TestInstance): string {
  return instance.children
    .map((child) =>
      typeof child === "string" ? child : textContent(child),
    )
    .join("");
}

function findButton(root: Root, label: string): TestInstance {
  return findElement(
    root,
    (instance) =>
      typeof instance.props.onPress === "function"
      && textContent(instance) === label,
    `botão ${label}`,
  );
}

function changeInput(root: Root, placeholder: string, value: string): void {
  const input = findElement(
    root,
    (instance) =>
      instance.type === "TextInput"
      && instance.props.placeholder === placeholder,
    `campo ${placeholder}`,
  );
  act(() => input.props.onChangeText(value));
}

function selectDate(root: Root): void {
  act(() => findButton(root, "Escolher data").props.onPress());
  const picker = findElement(
    root,
    (instance) => instance.props.testID === "date-picker",
    "seletor de data",
  );
  act(() => picker.props.onChange({}, new Date(2000, 0, 15)));
}

describe("NovaDespesaPessoal screen", () => {
  let root: Root;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(useCategoriasFinanceiras).mockReturnValue({
      categorias: [{ nome: "Alimentação", icone: "🍽️" }],
      erro: null,
    });
    jest.mocked(despesasPessoaisApi.criar).mockResolvedValue({
      status: "success",
      data: {} as never,
    });
    root = createRoot({ textComponentTypes: ["Text"] });
    await act(async () => {
      root.render(<NovaDespesaPessoal />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("creates a valid expense using normalized currency and date values", async () => {
    changeInput(root, "Ex.: Mercado", "  Mercado  ");
    changeInput(root, "0,00", "12,34");
    selectDate(root);

    await act(async () => {
      findButton(root, "Salvar despesa").props.onPress();
    });

    expect(despesasPessoaisApi.criar).toHaveBeenCalledWith({
      descricao: "Mercado",
      valor: 12.34,
      categoria: "Alimentação",
      tipo: "despesa",
      data_despesa: "2000-01-15",
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Despesa salva",
      "Cadastrada com sucesso.",
      expect.any(Array),
    );
  });

  it("rejects a zero amount without calling the API", async () => {
    changeInput(root, "Ex.: Mercado", "Mercado");
    changeInput(root, "0,00", "0,00");
    await act(async () => {
      await findButton(root, "Salvar despesa").props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Atenção",
      "Digite um valor válido.",
    );
    expect(despesasPessoaisApi.criar).not.toHaveBeenCalled();
  });

  it("keeps the user on the screen when saving fails", async () => {
    jest.mocked(despesasPessoaisApi.criar).mockRejectedValueOnce(
      new Error("Falha ao salvar"),
    );
    changeInput(root, "Ex.: Mercado", "Mercado");
    changeInput(root, "0,00", "12,34");
    selectDate(root);

    await act(async () => {
      findButton(root, "Salvar despesa").props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith("Erro", "Falha ao salvar");
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      findButton(root, "Salvar despesa").props.onPress();
    });

    expect(despesasPessoaisApi.criar).toHaveBeenCalledTimes(2);
    expect(Alert.alert).toHaveBeenLastCalledWith(
      "Despesa salva",
      "Cadastrada com sucesso.",
      expect.any(Array),
    );
  });
});
