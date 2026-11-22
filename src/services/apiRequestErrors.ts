export const API_REQUEST_TIMEOUT_MS = 15_000;

export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `A requisição excedeu o tempo limite de ${timeoutMs} ms. Tente novamente.`,
    );
    this.name = "ApiTimeoutError";
  }
}

export function getAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("A requisição foi cancelada.");
  error.name = "AbortError";
  return error;
}
