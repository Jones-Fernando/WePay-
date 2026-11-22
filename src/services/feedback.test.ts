import { Alert as NativeAlert } from "react-native";
import { Alert, subscribeFeedback } from "@/services/feedback";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

describe("global feedback", () => {
  let notifications: { type: string; title: string; message: string }[];
  let unsubscribe: () => void;

  beforeEach(() => {
    notifications = [];
    unsubscribe = subscribeFeedback((notice) => {
      notifications.push(notice);
    });
  });

  afterEach(() => {
    unsubscribe();
    jest.clearAllMocks();
  });

  it("turns success alerts into toast notifications and preserves their action", () => {
    const onPress = jest.fn();

    Alert.alert("Despesa salva", "Cadastrada com sucesso.", [
      { text: "OK", onPress },
    ]);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "success",
      title: "Despesa salva",
      message: "Cadastrada com sucesso.",
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(NativeAlert.alert).not.toHaveBeenCalled();
  });

  it("turns validation and error alerts into warning/error toasts", () => {
    Alert.alert("Atenção", "Preencha o e-mail.");
    Alert.alert("Erro", "Não foi possível salvar.");

    expect(notifications.map(({ type }) => type)).toEqual(["warning", "error"]);
  });

  it("keeps multi-action confirmation dialogs native", () => {
    const buttons = [
      { text: "Cancelar", style: "cancel" as const },
      { text: "Excluir", style: "destructive" as const },
    ];

    Alert.alert("Excluir despesa", "Esta ação não pode ser desfeita.", buttons);

    expect(NativeAlert.alert).toHaveBeenCalledWith(
      "Excluir despesa",
      "Esta ação não pode ser desfeita.",
      buttons,
    );
    expect(notifications).toHaveLength(0);
  });
});
