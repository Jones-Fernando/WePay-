/**
 * WEPAY — DADOS MOCKADOS
 *
 * Dados temporários usados durante a construção do frontend.
 * Devem ser substituídos pelas respostas da API quando o Flask estiver pronto.
 */

import { Usuario } from "@/types/usuario";

export const usuarioMockado: Usuario = {
  id: "usuario-1",
  nome: "Jones Simplício",
  email: "jones@email.com",
  telefone: "(00) 00000-0000",
  iniciais: "JS",
  saldoTotal: 240.5,
};

export const resumoFinanceiroMockado = {
  saldoGeral: 240.5,
  aPagar: 90,
};

export const gruposMockados = [
  { id: 1, nome: "Viagem Bahia", participantes: 4, iniciais: "VB", saldo: 120 },
  { id: 2, nome: "Apê Rep. 302", participantes: 3, iniciais: "RP", saldo: -45 },
];

export const despesasPessoaisMockadas = [
  { id: 1, icone: "🛒", titulo: "Mercado", categoria: "Alimentação", data: "4 mai", valor: "R$ 210,00" },
  { id: 2, icone: "🚕", titulo: "Corrida app", categoria: "Transporte", data: "6 mai", valor: "R$ 28,90" },
  { id: 3, icone: "🎬", titulo: "Assinatura streaming", categoria: "Assinatura", data: "8 mai", valor: "R$ 39,90" },
];
