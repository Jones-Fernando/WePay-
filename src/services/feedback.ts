import { Alert as NativeAlert, type AlertButton } from "react-native";

export type FeedbackType = "success" | "error" | "warning" | "info";

export type FeedbackNotification = {
  id: number;
  type: FeedbackType;
  title: string;
  message: string;
};

type FeedbackListener = (notification: FeedbackNotification) => void;

const listeners = new Set<FeedbackListener>();
let nextId = 0;

export function subscribeFeedback(listener: FeedbackListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showFeedback(
  type: FeedbackType,
  title: string,
  message: string,
): void {
  const notification = { id: ++nextId, type, title, message };
  listeners.forEach((listener) => listener(notification));
}

function classifyAlert(title: string): FeedbackType {
  const normalizedTitle = title.toLocaleLowerCase("pt-BR");
  if (/erro|falha|nao foi|não foi|nao identific|não identific|inval|inv[aá]l|expirad|diferent/.test(normalizedTitle)) {
    return "error";
  }
  if (/sucesso|cadastro solicitado|solicita[cç][aã]o recebida|salv[oa]|registrad|enviado|redefinid|atualizad|criad|removid/.test(normalizedTitle)) {
    return "success";
  }
  if (/aten[cç][aã]o|permiss[aã]o|inv[aá]lid/.test(normalizedTitle)) {
    return "warning";
  }
  return "info";
}

function needsConfirmation(buttons?: AlertButton[]): boolean {
  return Boolean(
    buttons?.length && (
      buttons.length > 1
      || buttons.some((button) => button.style === "cancel" || button.style === "destructive")
    ),
  );
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ): void {
    if (needsConfirmation(buttons)) {
      NativeAlert.alert(title, message, buttons);
      return;
    }

    showFeedback(
      classifyAlert(title),
      title,
      message ?? "",
    );
    buttons?.[0]?.onPress?.();
  },
};
