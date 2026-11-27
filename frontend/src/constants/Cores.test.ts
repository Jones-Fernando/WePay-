import { Cores, CoresPorTema, resolverTema } from "@/constants/Cores";

describe("app theme palette", () => {
  it("preserves the original light brand colors", () => {
    expect({
      fundo: Cores.fundo,
      texto: Cores.texto,
      textoSuave: Cores.textoSuave,
      principal: Cores.principal,
      principalEscuro: Cores.principalEscuro,
      negativo: Cores.negativo,
      borda: Cores.borda,
      campo: Cores.campo,
      branco: Cores.branco,
      textoSecundario: Cores.textoSecundario,
      tinta: Cores.tinta,
      destaque: Cores.destaque,
      subtexto: Cores.subtexto,
      cartaoFundo: Cores.cartaoFundo,
      fundoCampo: Cores.fundoCampo,
      alerta: Cores.alerta,
    }).toEqual({
      fundo: "#F5FBF7",
      texto: "#0B3B33",
      textoSuave: "#6B8F86",
      principal: "#00C896",
      principalEscuro: "#00A17A",
      negativo: "#FF6B5C",
      borda: "#E1EEE8",
      campo: "#F0F8F4",
      branco: "#FFFFFF",
      textoSecundario: "#12483F",
      tinta: "#0B3B33",
      destaque: "#00C896",
      subtexto: "#6B8F86",
      cartaoFundo: "#FFFFFF",
      fundoCampo: "#F0F8F4",
      alerta: "#FF6B5C",
    });
  });

  it("provides the black-led dark palette with readable surfaces", () => {
    expect(CoresPorTema.dark.fundo).toBe("#050505");
    expect(CoresPorTema.dark.cartaoFundo).toBe("#141617");
    expect(CoresPorTema.dark.fundoCampo).toBe("#1A1D1D");
    expect(CoresPorTema.dark.texto).toBe("#F4F6F5");
    expect(CoresPorTema.dark.principal).toBe("#00C896");
  });

  it("resolves explicit preferences before the system scheme", () => {
    expect(resolverTema("Claro", "dark")).toBe("light");
    expect(resolverTema("Escuro", "light")).toBe("dark");
    expect(resolverTema("Sistema", "dark")).toBe("dark");
    expect(resolverTema("Sistema", "light")).toBe("light");
    expect(resolverTema("Sistema", null)).toBe("light");
  });
});
