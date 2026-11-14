import {
  CATEGORIAS_GRUPO,
  CATEGORIAS_PESSOAIS,
  CATEGORIAS_RECIBO,
  mesclarCategorias,
} from "@/constants/financeCategories";

describe("finance category options", () => {
  it("adds custom categories without duplicating defaults", () => {
    const categories = mesclarCategorias(CATEGORIAS_PESSOAIS, [
      "Alimentação",
      "Viagem de trabalho",
    ]);

    expect(categories).toHaveLength(CATEGORIAS_PESSOAIS.length + 1);
    expect(categories.at(-1)).toEqual({
      nome: "Viagem de trabalho",
      icone: "📌",
    });
  });

  it("keeps the existing category sets for each workflow", () => {
    expect(CATEGORIAS_GRUPO.map(({ nome }) => nome)).toContain("Mercado");
    expect(CATEGORIAS_PESSOAIS.map(({ nome }) => nome)).toContain("Pets");
    expect(CATEGORIAS_RECIBO.map(({ nome }) => nome)).not.toContain("Pets");
  });
});
