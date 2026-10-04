/**
 * Arquivo: src/types/usuario.ts
 * Objetivo: Definir os dados referentes ao perfil do usuário logado.
 */

export interface Usuario {
  id: string;         // Identificador único do usuário
  nome: string;       // Nome completo ou apelido
  email: string;      // E-mail usado no login
  telefone: string;   // Número de telefone do usuário (opcional)
  iniciais : string;  // Inciais do nome do Usuários ( ex: Jones Smith => JS )
  avatarUrl?: string; // Opcional: O usuário pode não ter feito o upload de uma foto de perfil ainda.
  saldoTotal: number; // Saldo geral consolidado (Pode ser positivo a receber ou negativo a pagar)
}