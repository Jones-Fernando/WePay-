import { act } from "react";
import { createRoot, type Root } from "test-renderer";
import { Platform } from "react-native";
import { router } from "expo-router";
import { authApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import RedefinirSenha from "../app/redefinir-senha";

jest.mock("react-native", () => ({
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "ios" },
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: object) => styles },
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ token: "reset-token" }),
}));

jest.mock("@/services/api", () => ({
  authApi: { redefinirSenha: jest.fn() },
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

describe("RedefinirSenha screen", () => {
  let root: Root;

  function textContent(instance: any): string {
    return instance.children
      .map((child: any) =>
        typeof child === "string" ? child : textContent(child),
      )
      .join("");
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    Platform.OS = "ios";
    root = createRoot({ textComponentTypes: ["Text"] });
    await act(async () => {
      root.render(<RedefinirSenha />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("uses an avoiding scroll container and keeps both password fields available", () => {
    const avoiding = root.container.queryAll(
      (instance) => instance.type === "KeyboardAvoidingView",
    )[0];
    const scroll = root.container.queryAll(
      (instance) => instance.type === "ScrollView",
    )[0];
    expect(avoiding.props.behavior).toBe("padding");
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scroll.props.showsVerticalScrollIndicator).toBe(false);

    const fields = root.container.queryAll(
      (instance) => instance.type === "TextInput",
    );
    expect(fields).toHaveLength(2);
    expect(fields[0].props.textContentType).toBe("newPassword");
    expect(fields[1].props.textContentType).toBe("newPassword");
  });

  it("moves focus to the confirmation field when next is submitted", () => {
    const fields = root.container.queryAll(
      (instance) => instance.type === "TextInput",
    );
    const focus = jest.fn();
    fields[1].props.ref.current.focus = focus;

    act(() => fields[0].props.onSubmitEditing());

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ios", "padding"],
    ["android", "height"],
  ])("keeps the form keyboard-usable on %s", async (platform, behavior) => {
    Platform.OS = platform as typeof Platform.OS;
    await act(async () => {
      root.render(<RedefinirSenha />);
    });

    const avoiding = root.container.queryAll(
      (instance) => instance.type === "KeyboardAvoidingView",
    )[0];
    const scroll = root.container.queryAll(
      (instance) => instance.type === "ScrollView",
    )[0];
    const fields = root.container.queryAll(
      (instance) => instance.type === "TextInput",
    );

    expect(avoiding.props.behavior).toBe(behavior);
    expect(scroll.props.contentContainerStyle.flexGrow).toBe(1);
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
    expect(fields.every((field) => field.props.style[0].minHeight >= 52)).toBe(true);
  });

  it("keeps login navigation available after a successful reset", async () => {
    jest.mocked(authApi.redefinirSenha).mockResolvedValue({ status: "success" });
    const fields = root.container.queryAll(
      (instance) => instance.type === "TextInput",
    );

    await act(async () => {
      fields[0].props.onChangeText("Ab1!cdefghij");
      fields[1].props.onChangeText("Ab1!cdefghij");
    });

    const submit = root.container.queryAll(
      (instance) =>
        instance.type === "TouchableOpacity"
        && textContent(instance) === "Redefinir senha",
    )[0];
    expect(submit).toBeTruthy();

    await act(async () => submit?.props.onPress());

    expect(authApi.redefinirSenha).toHaveBeenCalledWith(
      "reset-token",
      "Ab1!cdefghij",
    );
    const alertCall = jest.mocked(Alert.alert).mock.calls.find(
      ([title]) => title === "Senha redefinida",
    );
    expect(alertCall).toBeTruthy();
    const onPress = alertCall?.[2]?.[0].onPress;
    expect(onPress).toBeDefined();
    if (onPress) act(() => onPress());
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });
});
