import {
  getAccessToken,
  refreshAccessToken,
} from "@/services/authSession";
import {
  lerReciboComIa,
} from "@/services/leitorIaServico";

jest.mock("@/services/authSession", () => ({
  getAccessToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

class XMLHttpRequestDouble {
  static instances: XMLHttpRequestDouble[] = [];

  timeout = 0;
  status = 0;
  responseText = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();

  constructor() {
    XMLHttpRequestDouble.instances.push(this);
  }
}

class FormDataDouble {
  append = jest.fn();
}

describe("lerReciboComIa", () => {
  beforeEach(() => {
    XMLHttpRequestDouble.instances = [];
    jest.mocked(getAccessToken).mockResolvedValue("access-token");
    jest.mocked(refreshAccessToken).mockResolvedValue(null);
    Object.defineProperty(globalThis, "XMLHttpRequest", {
      configurable: true,
      value: XMLHttpRequestDouble,
    });
    Object.defineProperty(globalThis, "FormData", {
      configurable: true,
      value: FormDataDouble,
    });
  });

  it("rejects a stalled upload after the configured timeout", async () => {
    const request = lerReciboComIa({ uri: "file:///receipt.jpg" });
    await Promise.resolve();
    const xhr = XMLHttpRequestDouble.instances[0];

    expect(xhr.timeout).toBe(60000);
    xhr.ontimeout?.();

    await expect(request).rejects.toThrow("Tempo de conexão esgotado.");
  });

  it("shows the retryable server message when the AI provider is busy", async () => {
    const request = lerReciboComIa({ uri: "file:///receipt.jpg" });
    await Promise.resolve();
    const xhr = XMLHttpRequestDouble.instances[0];
    xhr.status = 503;
    xhr.responseText = JSON.stringify({
      message: "O serviço de leitura está temporariamente ocupado.",
    });
    xhr.onload?.();

    await expect(request).rejects.toThrow(
      "O serviço de leitura está temporariamente ocupado.",
    );
  });
});
