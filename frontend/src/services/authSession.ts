import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE_URL } from "@/services/apiConfig";
import {
  API_REQUEST_TIMEOUT_MS,
  ApiTimeoutError,
  getAbortError,
} from "@/services/apiRequestErrors";

const ACCESS_TOKEN_KEY = "wepay_access_token";
const REFRESH_TOKEN_KEY = "wepay_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "@wepay:token";
const LEGACY_REFRESH_TOKEN_KEY = "@wepay:refresh_token";

type SessionExpiredListener = () => void;
type RefreshAccessTokenOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};
type RefreshResponse = {
  data?: {
    token?: unknown;
    refresh_token?: unknown;
  };
  message?: string;
};

const sessionExpiredListeners = new Set<SessionExpiredListener>();
type RefreshOperation = {
  controller: AbortController;
  promise: Promise<string | null>;
  timeoutId: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  settled: boolean;
  waiters: number;
};
let refreshInProgress: RefreshOperation | null = null;
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

function startRefresh(timeoutMs: number): RefreshOperation {
  const operation = {
    controller: new AbortController(),
    promise: Promise.resolve(null) as Promise<string | null>,
    timeoutId: setTimeout(() => {
      operation.timedOut = true;
      operation.controller.abort();
    }, timeoutMs),
    timedOut: false,
    settled: false,
    waiters: 0,
  };

  operation.promise = (async () => {
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
        signal: operation.controller.signal,
      });
    } catch {
      if (operation.timedOut) throw new ApiTimeoutError(timeoutMs);
      if (operation.controller.signal.aborted) {
        throw getAbortError(operation.controller.signal);
      }
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
  })().catch((error: unknown) => {
    if (operation.timedOut) throw new ApiTimeoutError(timeoutMs);
    if (operation.controller.signal.aborted) {
      throw getAbortError(operation.controller.signal);
    }
    throw error;
  }).finally(() => {
    clearTimeout(operation.timeoutId);
    operation.settled = true;
    if (refreshInProgress === operation) refreshInProgress = null;
  });

  refreshInProgress = operation;
  return operation;
}

function waitForRefresh(
  operation: RefreshOperation,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return Promise.reject(getAbortError(signal));

  operation.waiters += 1;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      signal?.removeEventListener("abort", onAbort);
      operation.waiters -= 1;
      if (!operation.settled && operation.waiters === 0) {
        operation.controller.abort();
        if (refreshInProgress === operation) refreshInProgress = null;
      }
    };
    const onAbort = () => {
      release();
      reject(getAbortError(signal));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    operation.promise.then(
      (token) => {
        release();
        resolve(token);
      },
      (error: unknown) => {
        release();
        reject(error);
      },
    );
  });
}

export function refreshAccessToken(
  options: RefreshAccessTokenOptions = {},
): Promise<string | null> {
  const { signal, timeoutMs = API_REQUEST_TIMEOUT_MS } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(
      new RangeError("timeoutMs deve ser um número maior que zero."),
    );
  }
  if (signal?.aborted) return Promise.reject(getAbortError(signal));

  const operation =
    refreshInProgress && !refreshInProgress.controller.signal.aborted
      ? refreshInProgress
      : startRefresh(timeoutMs);
  return waitForRefresh(operation, signal);
}
