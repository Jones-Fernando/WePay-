import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PUSH_TOKEN_KEY = "wepay_expo_push_token";
const LEGACY_PUSH_TOKEN_KEY = "@wepay:expo_push_token";
let somAtivado = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: somAtivado,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function configurarSomNotificacoes(ativado: boolean) {
  somAtivado = ativado;
}

export function obterPlataformaPush(): "ios" | "android" | null {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return null;
}

function obterProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || Constants.easConfig?.projectId
    || Constants.expoConfig?.extra?.eas?.projectId
  );
}

async function configurarCanaisAndroid() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notificações",
    importance: AndroidImportance.MAX,
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("silent", {
    name: "Notificações silenciosas",
    importance: AndroidImportance.MAX,
    sound: null,
  });
}

export async function obterTokenPush(
  solicitarPermissao: boolean,
): Promise<string | null> {
  const plataforma = obterPlataformaPush();
  if (!plataforma) return null;
  if (!Device.isDevice) {
    throw new Error(
      "Notificações push precisam ser configuradas em um dispositivo físico.",
    );
  }

  const projectId = obterProjectId();
  if (!projectId) {
    throw new Error(
      "Configure EXPO_PUBLIC_EAS_PROJECT_ID antes de ativar notificações push.",
    );
  }

  await configurarCanaisAndroid();
  let permissao = await Notifications.getPermissionsAsync();
  if (!permissao.granted && solicitarPermissao) {
    permissao = await Notifications.requestPermissionsAsync();
  }
  if (!permissao.granted) return null;

  const resposta = await Notifications.getExpoPushTokenAsync({ projectId });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, resposta.data);
  return resposta.data;
}

export async function obterTokenPushSalvo(): Promise<string | null> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(LEGACY_PUSH_TOKEN_KEY);
    return null;
  }

  const tokenSeguro = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (tokenSeguro !== null) {
    await AsyncStorage.removeItem(LEGACY_PUSH_TOKEN_KEY);
    return tokenSeguro;
  }

  const tokenLegado = await AsyncStorage.getItem(LEGACY_PUSH_TOKEN_KEY);
  if (tokenLegado !== null) {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, tokenLegado);
    await AsyncStorage.removeItem(LEGACY_PUSH_TOKEN_KEY);
  }
  return tokenLegado;
}

export async function limparTokenPushSalvo(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(LEGACY_PUSH_TOKEN_KEY);
    return;
  }

  await Promise.all([
    SecureStore.deleteItemAsync(PUSH_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_PUSH_TOKEN_KEY),
  ]);
}
