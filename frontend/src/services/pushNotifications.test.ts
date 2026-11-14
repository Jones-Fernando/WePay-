import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  limparTokenPushSalvo,
  obterTokenPush,
  obterTokenPushSalvo,
} from "@/services/pushNotifications";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  easConfig: { projectId: "test-project" },
  expoConfig: null,
}));

jest.mock("expo-device", () => ({ isDevice: true }));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 },
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const asyncGetItem = jest.mocked(AsyncStorage.getItem);
const asyncRemoveItem = jest.mocked(AsyncStorage.removeItem);
const asyncSetItem = jest.mocked(AsyncStorage.setItem);
const secureGetItem = jest.mocked(SecureStore.getItemAsync);
const secureSetItem = jest.mocked(SecureStore.setItemAsync);
const secureDeleteItem = jest.mocked(SecureStore.deleteItemAsync);

describe("pushNotifications token storage", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    asyncGetItem.mockResolvedValue(null);
    asyncRemoveItem.mockResolvedValue(undefined);
    asyncSetItem.mockResolvedValue(undefined);
    secureGetItem.mockResolvedValue(null);
    secureSetItem.mockResolvedValue(undefined);
    secureDeleteItem.mockResolvedValue(undefined);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
    } as Notifications.NotificationPermissionsStatus);
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: "expo-push-token",
    } as Notifications.ExpoPushToken);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
    jest.clearAllMocks();
  });

  it("stores new native push tokens in SecureStore", async () => {
    await expect(obterTokenPush(false)).resolves.toBe("expo-push-token");

    expect(secureSetItem).toHaveBeenCalledWith(
      "wepay_expo_push_token",
      "expo-push-token",
    );
    expect(asyncSetItem).not.toHaveBeenCalled();
  });

  it("migrates a legacy token to SecureStore on first read", async () => {
    asyncGetItem.mockResolvedValueOnce("legacy-push-token");

    await expect(obterTokenPushSalvo()).resolves.toBe("legacy-push-token");

    expect(secureSetItem).toHaveBeenCalledWith(
      "wepay_expo_push_token",
      "legacy-push-token",
    );
    expect(asyncRemoveItem).toHaveBeenCalledWith("@wepay:expo_push_token");
  });

  it("prefers SecureStore without reading the legacy key", async () => {
    secureGetItem.mockResolvedValueOnce("secure-push-token");

    await expect(obterTokenPushSalvo()).resolves.toBe("secure-push-token");

    expect(asyncGetItem).not.toHaveBeenCalled();
  });

  it("clears both current and legacy native token storage", async () => {
    await limparTokenPushSalvo();

    expect(secureDeleteItem).toHaveBeenCalledWith("wepay_expo_push_token");
    expect(asyncRemoveItem).toHaveBeenCalledWith("@wepay:expo_push_token");
  });

  it("does not return or persist push tokens on web", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    await expect(obterTokenPushSalvo()).resolves.toBeNull();
    await expect(obterTokenPush(false)).resolves.toBeNull();

    expect(asyncRemoveItem).toHaveBeenCalledWith("@wepay:expo_push_token");
    expect(secureGetItem).not.toHaveBeenCalled();
    expect(secureSetItem).not.toHaveBeenCalled();
  });
});
