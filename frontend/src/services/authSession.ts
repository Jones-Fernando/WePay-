import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE_URL } from "@/services/apiConfig";

const ACCESS_TOKEN_KEY = "wepay_access_token";
const REFRESH_TOKEN_KEY = "wepay_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "@wepay:token";
const LEGACY_REFRESH_TOKEN_KEY = "@wepay:refresh_token";

type SessionExpiredListener = () => void;
type RefreshResponse = {
  data?: {
    token?: unknown;
    refresh_token?: unknown;
  };
  message?: string;
};

const sessionExpiredListeners = new Set<SessionExpiredListener>();
let refreshInProgress: Promise<string | null> | null = null;
let webAccessToken: string | null = null;
let webLegacyTokensRemoved: Promise<void> | null = null;

function isNativePlatform() {
  return Platform.OS !== "web";
}

function removeLegacyWebTokens(): Promise<void> {
  if (!webLegacyTokensRemoved) {
    webLegacyTokensRemoved = AsyncStorage.multiRemove([
      LEGACY_ACCESS_TOKEN_KEY,
      LEGACY_REFRESH_TOKEN_KEY,
    ]).catch((error: unknown) => {
      webLegacyTokensRemoved = null;
      throw error;
    });
  }
  return webLegacyTokensRemoved;
}

async function getStoredValue(
  secureKey: string,
  legacyKey: string,
): Promise<string | null> {
  if (!isNativePlatform()) {
    await removeLegacyWebTokens();
    return secureKey === ACCESS_TOKEN_KEY ? webAccessToken : null;
  }

  const secureValue = await SecureStore.getItemAsync(secureKey);
  if (secureValue !== null) return secureValue;

  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    await SecureStore.setItemAsync(secureKey, legacyValue);
    await AsyncStorage.removeItem(legacyKey);
  }
  return legacyValue;
}

export const getAccessToken = () =>
  getStoredValue(ACCESS_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY);
export const getRefreshToken = () =>
  getStoredValue(REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY);

export async function saveSessionTokens(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  if (isNativePlatform()) {
    if (!refreshToken) {
      throw new Error("O servidor não retornou o token de renovação.");
    }
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    await AsyncStorage.multiRemove([
      LEGACY_ACCESS_TOKEN_KEY,
      LEGACY_REFRESH_TOKEN_KEY,
    ]);
    return;
  }
  await removeLegacyWebTokens();
  webAccessToken = accessToken;
}

export async function clearSessionTokens(): Promise<void> {
  webAccessToken = null;
  if (isNativePlatform()) {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
    await AsyncStorage.multiRemove([
      LEGACY_ACCESS_TOKEN_KEY,
      LEGACY_REFRESH_TOKEN_KEY,
    ]);
    return;
  }
  await removeLegacyWebTokens();
}

export function subscribeSessionExpired(
  listener: SessionExpiredListener,
): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export async function expireSession(): Promise<void> {
  try {
    await clearSessionTokens();
  } finally {
    sessionExpiredListeners.forEach((listener) => listener());
  }
}

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    const refreshToken = await getRefreshToken();
    if (isNativePlatform() && !refreshToken) {
      await expireSession();
      return null;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: isNativePlatform() ? "same-origin" : "include",
        body: JSON.stringify(
          refreshToken ? { refresh_token: refreshToken } : {},
        ),
      });
    } catch {
      throw new Error("Não foi possível conectar ao servidor.");
    }

    const texto = await response.text();
    let json: RefreshResponse;
    try {
      json = JSON.parse(texto) as RefreshResponse;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }

    if (response.status === 401 || response.status === 403) {
      await expireSession();
      return null;
    }
    if (!response.ok) {
      throw new Error(json.message || "Não foi possível renovar a sessão.");
    }

    const accessToken = json.data?.token;
    const nextRefreshToken = json.data?.refresh_token;
    if (
      typeof accessToken !== "string"
      || (isNativePlatform() && typeof nextRefreshToken !== "string")
    ) {
      throw new Error("O servidor retornou uma sessão inválida.");
    }

    await saveSessionTokens(
      accessToken,
      typeof nextRefreshToken === "string" ? nextRefreshToken : undefined,
    );
    return accessToken;
  })().finally(() => {
    refreshInProgress = null;
  });

  return refreshInProgress;
}
