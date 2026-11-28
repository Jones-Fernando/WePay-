import * as ipaddr from "ipaddr.js";

const DEVELOPMENT_API_BASE_URL = "http://127.0.0.1:5000/api";
export const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_API_BASE_URL;

// A API fica habilitada por padrão.
// Para publicar somente o frontend, configure como "false".
export const API_ENABLED =
  process.env.EXPO_PUBLIC_API_ENABLED !== "false";

export function normalizeApiBaseUrl(value?: string): string {
  return (value?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function isPublicHostname(hostname: string): boolean {
  const normalizedHostname =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  if (ipaddr.isValid(normalizedHostname)) {
    return ipaddr.process(normalizedHostname).range() === "unicast";
  }

  const domain = normalizedHostname.toLowerCase().replace(/\.$/, "");
  const localSuffixes = [
    ".localhost",
    ".local",
    ".internal",
    ".test",
    ".invalid",
    ".example",
  ];
  const labels = domain.split(".");

  return (
    domain.length <= 253
    && labels.length >= 2
    && labels.every(
      (label) =>
        label.length <= 63
        && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
    && domain !== "localhost"
    && !localSuffixes.some((suffix) => domain.endsWith(suffix))
  );
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
    const apiUrl = value!.trim();

    try {
      url = new URL(apiUrl);
    } catch {
      throw new Error("EXPO_PUBLIC_API_URL deve ser uma URL válida.");
    }

    const schemeSeparator = apiUrl.indexOf("://");
    const authority =
      schemeSeparator >= 0
        ? apiUrl.slice(schemeSeparator + 3).split(/[/?#]/, 1)[0]
        : "";
    if (
      url.protocol !== "https:"
      || schemeSeparator < 0
      || url.username !== ""
      || url.password !== ""
      || authority === ""
      || authority.includes("@")
      || !isPublicHostname(url.hostname)
    ) {
      throw new Error(
        "EXPO_PUBLIC_API_URL em produção deve usar HTTPS e um host público.",
      );
    }
  }

  return normalizeApiBaseUrl(value);
}

// Quando a API estiver desativada, não exigimos URL pública.
export const API_BASE_URL = API_ENABLED
  ? resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL)
  : "";
