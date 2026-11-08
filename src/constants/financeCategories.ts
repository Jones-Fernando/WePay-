export interface CategoriaOpcao {
  nome: string;
  icone: string;
}

export const CATEGORIAS_GRUPO = [
  { nome: "Alimentação", icone: "🛒" },
  { nome: "Transporte", icone: "🚕" },
  { nome: "Casa", icone: "🏠" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Assinatura", icone: "🎬" },
  { nome: "Outros", icone: "📦" },
  { nome: "Mercado", icone: "🛒" },
  { nome: "Contas da casa", icone: "💡" },
  { nome: "Internet e telefone", icone: "📶" },
  { nome: "Limpeza", icone: "🧹" },
  { nome: "Manutenção e reparos", icone: "🔧" },
  { nome: "Hospedagem", icone: "🏨" },
  { nome: "Passagens", icone: "✈️" },
  { nome: "Combustível", icone: "⛽" },
  { nome: "Pedágios e estacionamento", icone: "🅿️" },
  { nome: "Passeios e ingressos", icone: "🎟️" },
] as const;

export const CATEGORIAS_PESSOAIS = [
  { nome: "Alimentação", icone: "🛒" },
  { nome: "Transporte", icone: "🚕" },
  { nome: "Casa", icone: "🏠" },
  { nome: "Moradia", icone: "🏘️" },
  { nome: "Saúde", icone: "💊" },
  { nome: "Educação", icone: "📚" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Assinatura", icone: "🎬" },
  { nome: "Assinaturas", icone: "🎬" },
  { nome: "Compras", icone: "🛍️" },
  { nome: "Pets", icone: "🐾" },
  { nome: "Viagem", icone: "✈️" },
  { nome: "Impostos", icone: "🧾" },
  { nome: "Outros", icone: "📦" },
] as const;

const CATEGORIAS_RECIBO_NOMES = new Set([
  "Alimentação",
  "Transporte",
  "Casa",
  "Lazer",
  "Assinatura",
  "Outros",
]);

export const CATEGORIAS_RECIBO = CATEGORIAS_PESSOAIS.filter(({ nome }) =>
  CATEGORIAS_RECIBO_NOMES.has(nome)
);

export function mesclarCategorias(
  padrao: readonly CategoriaOpcao[],
  personalizadas: readonly string[],
): CategoriaOpcao[] {
  const nomes = new Set(padrao.map(({ nome }) => nome));
  return [
    ...padrao,
    ...personalizadas
      .filter((nome) => {
        if (nomes.has(nome)) return false;
        nomes.add(nome);
        return true;
      })
      .map((nome) => ({ nome, icone: "📌" })),
  ];
}
