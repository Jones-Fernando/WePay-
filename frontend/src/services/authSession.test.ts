import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  saveSessionTokens,
  clearSessionTokens,
  subscribeSessionExpired,
} from "@/services/authSession";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    multiRemove: jest.fn(),
    multiSet: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const asyncGetItem = jest.mocked(AsyncStorage.getItem);
const asyncMultiRemove = jest.mocked(AsyncStorage.multiRemove);
const secureGetItem = jest.mocked(SecureStore.getItemAsync);
const secureSetItem = jest.mocked(SecureStore.setItemAsync);
const secureDeleteItem = jest.mocked(SecureStore.deleteItemAsync);

describe("authSession", () => {
  beforeEach(() => {
    asyncGetItem.mockResolvedValue(null);
    asyncMultiRemove.mockResolvedValue(undefined);
    secureGetItem.mockResolvedValue(null);
    secureSetItem.mockResolvedValue(undefined);
    secureDeleteItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("migrates a legacy native access token to secure storage", async () => {
    secureGetItem.mockResolvedValueOnce(null);
    asyncGetItem.mockResolvedValueOnce("legacy-access-token");

    await expect(getAccessToken()).resolves.toBe("legacy-access-token");

    expect(secureSetItem).toHaveBeenCalledWith(
      "wepay_access_token",
      "legacy-access-token",
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@wepay:token");
  });

  it("coalesces concurrent refreshes and stores the rotated tokens", async () => {
    asyncGetItem.mockResolvedValueOnce("old-refresh-token");
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        data: {
          token: "new-access-token",
          refresh_token: "new-refresh-token",
        },
      }),
    } as Response);

    const sessions = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(sessions).toEqual(["new-access-token", "new-access-token"]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(secureSetItem).toHaveBeenCalledWith(
      "wepay_access_token",
      "new-access-token",
    );
    expect(secureSetItem).toHaveBeenCalledWith(
      "wepay_refresh_token",
      "new-refresh-token",
    );
  });

  it.each([401, 403])(
    "clears local tokens and notifies the app when refresh is rejected with %i",
    async (status) => {
      asyncGetItem.mockResolvedValueOnce("expired-refresh-token");
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        status,
        ok: false,
        text: async () => JSON.stringify({ message: "Sessão expirada." }),
      } as Response);
      const onExpired = jest.fn();
      const unsubscribe = subscribeSessionExpired(onExpired);

      await expect(refreshAccessToken()).resolves.toBeNull();

      expect(secureDeleteItem).toHaveBeenCalledTimes(2);
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        "@wepay:token",
        "@wepay:refresh_token",
      ]);
      expect(onExpired).toHaveBeenCalledTimes(1);
      unsubscribe();
    },
  );

  it("uses only SecureStore-compatible keys", async () => {
    await saveSessionTokens("access-token", "refresh-token");

    for (const [key] of secureSetItem.mock.calls) {
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("keeps refresh credentials when the server cannot be reached", async () => {
    asyncGetItem.mockResolvedValueOnce("usable-refresh-token");
    jest.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network error"),
    );

    await expect(refreshAccessToken()).rejects.toThrow(
      "Não foi possível conectar ao servidor.",
    );

    expect(secureDeleteItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });

  it("keeps web access tokens only in memory and never persists refresh tokens", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    try {
      await clearSessionTokens();
      await saveSessionTokens("web-access-token", "must-not-be-persisted");

      await expect(getAccessToken()).resolves.toBe("web-access-token");
      await expect(getRefreshToken()).resolves.toBeNull();
      expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        "@wepay:token",
        "@wepay:refresh_token",
      ]);
      expect(secureSetItem).not.toHaveBeenCalled();
    } finally {
      await clearSessionTokens();
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("renews web sessions with the HttpOnly cookie and stores only access in memory", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ data: { token: "renewed-web-access" } }),
    } as Response);
    try {
      await expect(refreshAccessToken()).resolves.toBe("renewed-web-access");

      const [url, options] = jest.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toEqual(expect.stringMatching(/\/auth\/refresh$/));
      expect(options?.credentials).toBe("include");
      expect(options?.body).toBe("{}");
      await expect(getAccessToken()).resolves.toBe("renewed-web-access");
      await expect(getRefreshToken()).resolves.toBeNull();
    } finally {
      await clearSessionTokens();
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });
});
