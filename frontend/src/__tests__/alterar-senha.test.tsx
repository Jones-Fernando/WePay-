import { act } from "react";
import { createRoot, type Root, type TestInstance } from "test-renderer";
import AlterarSenha from "../app/(main)/alterar-senha";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/services/api", () => ({
  authApi: { alterarSenha: jest.fn() },
}));

jest.mock("@/contexts/UsuarioContext", () => ({
  useUsuario: () => ({ logout: jest.fn() }),
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

function textContent(instance: TestInstance): string {
  return instance.children
    .map((child) =>
      typeof child === "string" ? child : textContent(child),
    )
    .join("");
}

describe("AlterarSenha screen", () => {
  let root: Root;

  beforeEach(async () => {
    root = createRoot({ textComponentTypes: ["Text"] });
    await act(async () => {
      root.render(<AlterarSenha />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("shows and hides each password independently", () => {
    const placeholders = [
      "Digite sua senha atual",
      "Digite a nova senha",
      "Repita a nova senha",
    ];
    const visibleFields = [false, false, false];

    for (let index = 0; index < placeholders.length; index += 1) {
      const inputs = placeholders.map((placeholder) =>
        root.container.queryAll(
          (instance) =>
            instance.type === "TextInput"
            && instance.props.placeholder === placeholder,
        )[0],
      );
      expect(inputs.map((input) => input?.props.secureTextEntry)).toEqual(
        visibleFields.map((visible) => !visible),
      );

      const showButton = root.container.queryAll(
        (instance) =>
          typeof instance.props.onPress === "function"
          && textContent(instance) === "Mostrar",
      )[0];
      expect(showButton).toBeTruthy();

      act(() => showButton.props.onPress());
      visibleFields[index] = true;

      const updatedInputs = placeholders.map((placeholder) =>
        root.container.queryAll(
          (instance) =>
            instance.type === "TextInput"
            && instance.props.placeholder === placeholder,
        )[0],
      );
      expect(updatedInputs.map((input) => input?.props.secureTextEntry)).toEqual(
        visibleFields.map((visible) => !visible),
      );
    }

    const hideButtons = root.container.queryAll(
      (instance) =>
        typeof instance.props.onPress === "function"
        && textContent(instance) === "Ocultar",
    );
    expect(hideButtons).toHaveLength(3);

    act(() => hideButtons[0].props.onPress());
    expect(
      root.container.queryAll(
        (instance) =>
          instance.type === "TextInput"
          && instance.props.placeholder === placeholders[0],
      )[0].props.secureTextEntry,
    ).toBe(true);
  });
});
