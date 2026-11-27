/**
 * Arquivo: src/types/despesa.ts
 * Objetivo: Definir os "contratos" (formatos rigorosos) para os dados financeiros.
 * Vantagem para o TCC: O TypeScript prevê erros antes mesmo do app rodar. Ele impede, por exemplo, que o sistema tente somar um texto com um número.
 */

// 'CategoriaDespesa' restringe as opções de categoria. 
// O usuário só poderá escolher uma destas opções, evitando erros de digitação no banco de dados.
export type CategoriaDespesa = 'alimentacao' | 'transporte' | 'lazer' | 'moradia' | 'outros';

// A interface 'Despesa' define exatamente quais campos uma despesa precisa ter.
export interface Despesa {
  id: string;                  // Identificador único (geralmente gerado pelo banco de dados)
  titulo: string;              // Nome descritivo da despesa (Ex: "Supermercado da semana")
  valor: number;               // O valor monetário (Sempre numérico para permitir cálculos)
  data: string;                // A data em que ocorreu, armazenada como texto (formato ISO ou DD/MM/AAAA)
  categoria: CategoriaDespesa; // Deve ser obrigatoriamente um dos valores do 'type' definido acima
  pagoPor: string;             // Nome ou ID da pessoa que efetuou o pagamento
  ehPessoal: boolean;          // Define a regra de negócio: 'true' para gasto individual, 'false' para gasto do grupo
  
  // O ponto de interrogação (?) significa que o comprovante é OPCIONAL.
  // Uma despesa pode ser criada manualmente sem enviar uma foto do recibo.
  comprovanteUrl?: string;     
}