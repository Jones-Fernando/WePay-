export interface ApiResponse<T> {
  status: "sucesso" | "erro";
  data: T;
  message?: string;
  mensagem?: string;
}

export interface DespesaPessoal {
  id: number;
  usuario_id: number;
  descricao: string;
  valor: number;
  categoria: string | null;
  tipo: "despesa" | "receita";
  data_despesa: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ResumoPessoal {
  total_despesas: number;
  total_receitas: number;
  saldo: number;
  ano: number;
  mes: number;
}

export interface Grupo {
  id: number;
  nome: string;
  descricao: string | null;
  criado_por: number;
  criado_em: string;
}

export interface Participante {
  id: number;
  grupo_id: number;
  usuario_id: number;
  papel: "admin" | "participante";
  ativo: number;
  nome?: string;
  email?: string;
}

export interface DivisaoDespesa {
  usuario_id: number;
  tipo: "igual" | "porcentagem" | "valores";
  percentual: number | null;
  valor: number;
  nome?: string;
}

export interface DespesaGrupo {
  id: number;
  grupo_id: number;
  pagador_id: number;
  descricao: string;
  categoria: string | null;
  valor: number;
  data_despesa: string;
  vencimento: string | null;
  criado_em: string;
  pagador_nome?: string;
  divisoes?: DivisaoDespesa[];
}

export interface SaldoGrupo {
  usuario_id: number;
  nome: string;
  email: string;
  saldo: number;
  papel: "admin" | "participante";
  ativo: number;
}

export interface DividaSimplificada {
  devedor_id: number;
  devedor: string;
  credor_id: number;
  credor: string;
  valor: number;
}

export interface ResumoSaldosGrupo {
  grupo_id: number;
  saldos: SaldoGrupo[];
  dividas_simplificadas: DividaSimplificada[];
}

export interface PagamentoGrupo {
  id: number;
  grupo_id: number;
  pagador_id: number;
  recebedor_id: number;
  valor: number;
  data_pagamento: string;
  metodo: string | null;
  observacao: string | null;
  pagador: string;
  recebedor: string;
}

export interface Dashboard {
  receber: number;
  pagar: number;
  total_grupos: number;
  total_gasto_grupos: number;
  total_gasto_pessoal: number;
  total_gasto_geral: number;
  total_despesas_grupos: number;
  lembretes_proximos: unknown[];
}
