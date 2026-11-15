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
});
