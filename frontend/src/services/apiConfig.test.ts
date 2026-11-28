import {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from "@/services/apiConfig";

describe("apiConfig", () => {
  it("uses the local default when the configured URL is missing or blank", () => {
    expect(normalizeApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    expect(normalizeApiBaseUrl("  ")).toBe(DEFAULT_API_BASE_URL);
  });

  it("trims whitespace and trailing slashes from the configured URL", () => {
    expect(normalizeApiBaseUrl(" https://api.example.com/api/// "))
      .toBe("https://api.example.com/api");
  });

  it("requires an API URL in production builds", () => {
    expect(() => resolveApiBaseUrl(undefined, true)).toThrow(
      "Configure EXPO_PUBLIC_API_URL",
    );
    expect(resolveApiBaseUrl(" https://api.example.com/api/ ", true))
      .toBe("https://api.example.com/api");
    expect(() => resolveApiBaseUrl("http://127.0.0.1:5000/api", true))
      .toThrow("deve usar HTTPS");
  });

  it.each([
    "https://user:secret@api.example.com/api",
    "https://@api.example.com/api",
    "https://10.2.3.4/api",
    "https://172.20.1.2/api",
    "https://192.168.1.2/api",
    "https://100.64.1.2/api",
    "https://169.254.1.2/api",
    "https://2130706433/api",
    "https://[::1]/api",
    "https://[fd12::1]/api",
    "https://[fe80::1]/api",
    "https://[::ffff:192.168.1.2]/api",
    "https://api.localhost/api",
    "https://*.example.com/api",
    "https://api_example.com/api",
  ])("rejects non-public production API URL %s", (url) => {
    expect(() => resolveApiBaseUrl(url, true)).toThrow("host público");
  });

  it.each([
    "https://8.8.8.8/api",
    "https://[2606:4700:4700::1111]/api",
    "https://api.example.com/api",
  ])("accepts public production API URL %s", (url) => {
    expect(resolveApiBaseUrl(url, true)).toBe(url);
  });

  it("does not configure a backend URL when the API is disabled", () => {
    const originalApiEnabled = process.env.EXPO_PUBLIC_API_ENABLED;
    process.env.EXPO_PUBLIC_API_ENABLED = "false";

    try {
      jest.isolateModules(() => {
        const config = jest.requireActual<typeof import("@/services/apiConfig")>(
          "@/services/apiConfig",
        );
        expect(config.API_ENABLED).toBe(false);
        expect(config.API_BASE_URL).toBe("");
      });
    } finally {
      if (originalApiEnabled === undefined) {
        delete process.env.EXPO_PUBLIC_API_ENABLED;
      } else {
        process.env.EXPO_PUBLIC_API_ENABLED = originalApiEnabled;
      }
    }
  });
});
