/**
 * Arquivo: src/components/TagStatus.tsx
 * Objetivo: Elemento gráfico em formato de pílula para sinalizar saldos e categorias.
 * Justificativa para o TCC: Oferece leitura rápida sobre se o saldo é positivo (+R$) ou negativo (-R$).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

interface TagStatusProps {
  valor: number; // Se for positivo fica verde, se for negativo fica vermelho
}

export const TagStatus: React.FC<TagStatusProps> = ({ valor }) => {
  const cores = useAppTheme();
  const estilos = criarEstilos();
  const ehPositivo = valor >= 0;
  
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(valor));

  return (
    <View 
      style={[
        estilos.container, 
        { backgroundColor: ehPositivo ? cores.superficieVerde : cores.superficieNegativa }
      ]}
    >
      <Text 
        style={[
          estilos.texto, 
          { color: ehPositivo ? cores.textoPositivo : cores.alerta }
        ]}
      >
        {ehPositivo ? `+ ${valorFormatado}` : `- ${valorFormatado}`}
      </Text>
    </View>
  );
};

const criarEstilos = () => StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  texto: {
    fontSize: 13,
    fontWeight: '700',
  },
});