/**
 * Arquivo: src/components/CartaoRecibo.tsx
 * Objetivo: Card de exibição de despesa formatado no estilo visual de um recibo físico de papel.
 * Justificativa para o TCC: Reforça a proposta temática da marca "WePay (Paper & Ink)" 
 * e consolida informações financeiras relevantes (título, pagador, data e valor formatado em R$).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Despesa } from '../types/despesa';
import { Cores } from '../constants/Cores';

interface CartaoReciboProps {
  despesa: Despesa;
  onPress?: () => void; // Ação ao clicar para abrir a tela de detalhes
}

export const CartaoRecibo: React.FC<CartaoReciboProps> = ({ despesa, onPress }) => {
  // Formatação monetária padrão em Real Brasileiro (R$)
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(despesa.valor);

  return (
    <TouchableOpacity 
      style={estilos.card} 
      onPress={onPress} 
      activeOpacity={0.85}
    >
      {/* Detalhe visual da faixa lateral indicando tipo de gasto */}
      <View 
        style={[
          estilos.indicadorTipo, 
          { backgroundColor: despesa.ehPessoal ? Cores.subtexto : Cores.destaque }
        ]} 
      />

      <View style={estilos.conteudo}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo} numberOfLines={1}>
            {despesa.titulo}
          </Text>
          <Text style={estilos.valor}>{valorFormatado}</Text>
        </View>

        {/* Linha divisória pontilhada simulando picote de recibo */}
        <View style={estilos.linhaPicotada} />

        <View style={estilos.rodape}>
          <Text style={estilos.infoTexto}>
            Pago por: <Text style={estilos.infoDestaque}>{despesa.pagoPor}</Text>
          </Text>
          <Text style={estilos.data}>{despesa.data}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const estilos = StyleSheet.create({
  card: {
    backgroundColor: Cores.cartaoFundo,
    borderRadius: 12,
    flexDirection: 'row',
    marginVertical: 6,
    overflow: 'hidden',
    // Configuração de Sombra para iOS e Android
    shadowColor: Cores.tinta,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  indicadorTipo: {
    width: 6,
  },
  conteudo: {
    flex: 1,
    padding: 14,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titulo: {
    fontSize: 16,
    fontWeight: '600',
    color: Cores.tinta,
    flex: 1,
    marginRight: 8,
  },
  valor: {
    fontSize: 16,
    fontWeight: '700',
    color: Cores.tinta,
  },
  linhaPicotada: {
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: Cores.borda,
    marginVertical: 10,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoTexto: {
    fontSize: 12,
    color: Cores.subtexto,
  },
  infoDestaque: {
    fontWeight: '600',
    color: Cores.tinta,
  },
  data: {
    fontSize: 12,
    color: Cores.subtexto,
  },
});