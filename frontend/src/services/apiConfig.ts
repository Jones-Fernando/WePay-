export const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000/api";

export function normalizeApiBaseUrl(value?: string): string {
  return (value?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function resolveApiBaseUrl(
  value?: string,
  production = process.env.NODE_ENV === "production",
): string {
  if (production && !value?.trim()) {
    throw new Error(
      "Configure EXPO_PUBLIC_API_URL antes de gerar o app para produção.",
    );
  }
  if (production) {
    let url: URL;
    try {
      url = new URL(value!.trim());
    } catch {
      throw new Error("EXPO_PUBLIC_API_URL deve ser uma URL válida.");
    }
    if (
      url.protocol !== "https:"
      || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      throw new Error(
        "EXPO_PUBLIC_API_URL em produção deve usar HTTPS e um host público.",
      );
    }
  }
  return normalizeApiBaseUrl(value);
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
