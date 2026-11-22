import { act } from "react";
import { createRoot, type Root, type TestInstance } from "test-renderer";
import { router } from "expo-router";
import { despesasPessoaisApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { Cores } from "@/constants/Cores";
import { formatDateForInput, parseDateInputToIso } from "@/utils/financeInput";
import NovaDespesaPessoal from "../app/(main)/personal/nova-despesa-pessoal";

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Alert: { alert: jest.fn() },
  Image: "Image",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
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

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/services/api", () => ({
  despesasPessoaisApi: { criar: jest.fn() },
}));

jest.mock("@/hooks/useCategoriasFinanceiras", () => ({
  useCategoriasFinanceiras: jest.fn(),
}));

jest.mock("@/hooks/useAppTheme", () => ({
  useAppTheme: () =>
    jest.requireActual<typeof import("@/constants/Cores")>(
      "@/constants/Cores",
    ).Cores,
  useAppThemeScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
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

function calendarDayTestId(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `calendar-day-${date.getFullYear()}-${month}-${day}`;
}

function selectDate(root: Root): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  act(() => {
    findElement(
      root,
      (instance) => instance.props.testID === "date-selector",
      "campo de data",
    ).props.onPress();
  });
  const dateButton = findElement(
    root,
    (instance) => instance.props.testID === calendarDayTestId(date),
    "dia no calendário",
  );
  act(() => dateButton.props.onPress());
  return date;
}

describe("NovaDespesaPessoal screen", () => {
  let root: Root;

  jest.spyOn(Alert, "alert");

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
    changeInput(root, "0,00", "123456");
    const valorInput = findElement(
      root,
      (instance) => instance.type === "TextInput" && instance.props.placeholder === "0,00",
      "campo Valor",
    );
    expect(valorInput.props.value).toBe("1.234,56");
    const dataSelecionada = selectDate(root);

    await act(async () => {
      findButton(root, "Salvar despesa").props.onPress();
    });

    expect(despesasPessoaisApi.criar).toHaveBeenCalledWith({
      descricao: "Mercado",
      valor: 1234.56,
      categoria: "Alimentação",
      tipo: "despesa",
      data_despesa: parseDateInputToIso(formatDateForInput(dataSelecionada)),
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Despesa salva",
      "Cadastrada com sucesso.",
      expect.any(Array),
    );
  });

  it("uses today's date by default when creating an expense", async () => {
    changeInput(root, "Ex.: Mercado", "Mercado");
    changeInput(root, "0,00", "12,34");
    const dataEsperada = parseDateInputToIso(formatDateForInput(new Date()));

    await act(async () => {
      findButton(root, "Salvar despesa").props.onPress();
    });

    expect(despesasPessoaisApi.criar).toHaveBeenCalledWith(
      expect.objectContaining({ data_despesa: dataEsperada }),
    );
  });

  it("opens a calendar with selectable dates from the date field", () => {
    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "date-selector",
        "campo de data",
      ).props.onPress();
    });

    expect(
      findElement(
        root,
        (instance) => instance.props.testID === "date-calendar",
        "calendário de datas",
      ),
    ).toBeTruthy();

    const primeiroDiaMes = new Date();
    primeiroDiaMes.setDate(1);
    expect(
      findElement(
        root,
        (instance) => instance.props.testID === calendarDayTestId(primeiroDiaMes),
        "primeiro dia do mês",
      ),
    ).toBeTruthy();
  });

  it("renders a fixed six-week calendar grid", () => {
    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "date-selector",
        "campo de data",
      ).props.onPress();
    });

    const dias = root.container.queryAll(
      (instance) =>
        typeof instance.props.testID === "string"
        && instance.props.testID.startsWith("calendar-day-"),
    );

    const mesAtual = new Date();
    const prefixoMesAtual =
      `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, "0")}-`;
    expect(dias).toHaveLength(
      new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate(),
    );
    expect(dias.every(
      (dia) =>
        typeof dia.props.testID === "string"
        && dia.props.testID.includes(prefixoMesAtual),
    )).toBe(true);

    const diasFuturos = dias.filter(
      (dia) =>
        typeof dia.props.testID === "string"
        && dia.props.testID.includes(prefixoMesAtual)
        && Number(dia.props.testID.slice(-2)) > mesAtual.getDate(),
    );
    expect(diasFuturos.every((dia) => dia.props.disabled)).toBe(true);

    const grade = findElement(
      root,
      (instance) =>
        instance.type === "View"
        && Array.isArray(instance.children)
        && instance.children.length === 6
        && instance.children.every((semana) =>
          typeof semana !== "string"
          && Array.isArray(semana.children)
          && semana.children.length === 7
        ),
      "grade fixa de seis linhas",
    );
    expect(grade.children).toHaveLength(6);
  });

  it("does not style a selected date from another month as selectable", () => {
    const primeiroDiaMes = new Date();
    primeiroDiaMes.setDate(1);
    primeiroDiaMes.setHours(0, 0, 0, 0);

    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "date-selector",
        "campo de data",
      ).props.onPress();
    });
    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === calendarDayTestId(primeiroDiaMes),
        "primeiro dia do mês",
      ).props.onPress();
    });
    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "date-selector",
        "campo de data",
      ).props.onPress();
    });
    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "previous-month",
        "mês anterior",
      ).props.onPress();
    });

    const diaAdjacenteSelecionado = root.container.queryAll(
      (instance) => instance.props.testID === calendarDayTestId(primeiroDiaMes),
    )[0];
    expect(diaAdjacenteSelecionado).toBeUndefined();

    const diasVisiveis = root.container.queryAll(
      (instance) =>
        typeof instance.props.testID === "string"
        && instance.props.testID.startsWith("calendar-day-"),
    );
    expect(diasVisiveis.some(
      (dia) => dia.props.testID === calendarDayTestId(primeiroDiaMes),
    )).toBe(false);
  });

  it("keeps 42 cells and stable sizing for 4-, 5-, and 6-week months", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2021, 7, 20, 12, 0, 0));

    await act(async () => root.unmount());
    root = createRoot({ textComponentTypes: ["Text"] });
    await act(async () => {
      root.render(<NovaDespesaPessoal />);
    });

    act(() => {
      findElement(
        root,
        (instance) => instance.props.testID === "date-selector",
        "campo de data",
      ).props.onPress();
    });

    const card = findElement(
      root,
      (instance) => instance.props.testID === "date-calendar",
      "cartão do calendário",
    );
    const tamanhoCard = card.props.style;

    const verificarGradeUniforme = (descricao: string, prefixoMes: string) => {
      const dias = root.container.queryAll(
        (instance) =>
          typeof instance.props.testID === "string"
          && instance.props.testID.startsWith("calendar-day-"),
      );
      const [ano, mes] = prefixoMes.slice(0, -1).split("-").map(Number);
      const diasNoMes = new Date(ano, mes, 0).getDate();
      expect(dias).toHaveLength(diasNoMes);
      expect(dias.every(
        (dia) =>
          typeof dia.props.testID === "string"
          && dia.props.testID.includes(prefixoMes),
      )).toBe(true);

      const grade = findElement(
        root,
        (instance) =>
          instance.type === "View"
          && Array.isArray(instance.children)
          && instance.children.filter((child) => typeof child !== "string").length === 6
          && instance.children.every((semana) =>
            typeof semana !== "string"
            && Array.isArray(semana.children)
            && semana.children.filter((child) => typeof child !== "string").length === 7
          ),
        `grade de seis linhas (${descricao})`,
      );
      expect(grade.children).toHaveLength(6);
      const celulasVisiveis = grade.children
        .flatMap((semana) =>
          typeof semana === "string" || !Array.isArray(semana.children)
            ? []
            : semana.children.filter((celula) => typeof celula !== "string"),
        );
      expect(celulasVisiveis).toHaveLength(42);
      const placeholderCount = celulasVisiveis.filter(
        (celula) =>
          typeof celula.props.testID !== "string"
          && typeof celula.props.onPress !== "function",
      ).length;
      expect(placeholderCount).toBe(42 - diasNoMes);

      for (const dia of dias) {
        const estilosDia = Array.isArray(dia.props.style)
          ? dia.props.style
          : [dia.props.style];
        expect(estilosDia.every((estilo) => estilo?.opacity == null)).toBe(true);
        const estilosTexto = dia.children
          .filter((child): child is TestInstance => typeof child !== "string")
          .flatMap((child) =>
            Array.isArray(child.props.style)
              ? child.props.style
              : [child.props.style],
          );
        if (dia.props.disabled) {
          expect(
            estilosDia.some(
              (estilo) => estilo?.backgroundColor === Cores.fundoCampo,
            ),
          ).toBe(true);
          expect(
            estilosTexto.some((estilo) => estilo?.color === Cores.texto),
          ).toBe(true);
        }
      }

      expect(card.props.style).toEqual(tamanhoCard);
    };

    verificarGradeUniforme("6 semanas", "2021-08-");

    const botaoAnterior = findElement(
      root,
      (instance) => instance.props.testID === "previous-month",
      "botão mês anterior",
    );
    for (let indice = 0; indice < 5; indice += 1) {
      act(() => botaoAnterior.props.onPress());
    }
    verificarGradeUniforme("5 semanas", "2021-03-");

    act(() => botaoAnterior.props.onPress());
    verificarGradeUniforme("4 semanas", "2021-02-");

    jest.useRealTimers();
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
