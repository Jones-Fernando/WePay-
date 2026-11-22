/**
 * Arquivo: src/components/BotaoFlutuante.tsx
 * Objetivo: Botão circular flutuante (FAB) fixado no canto inferior da tela.
 * Justificativa para o TCC: Garante um atalho rápido para a ação primária do aplicativo (adicionar despesa / escanear recibo).
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

interface BotaoFlutuanteProps {
  onPress: () => void;
}

export const BotaoFlutuante: React.FC<BotaoFlutuanteProps> = ({ onPress }) => {
  const cores = useAppTheme();
  const estilos = criarEstilos(cores);
  return (
    <TouchableOpacity 
      style={estilos.botao} 
      onPress={onPress} 
      activeOpacity={0.85}
    >
      <Text style={estilos.icone}>+</Text>
    </TouchableOpacity>
  );
};

const criarEstilos = (cores: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  botao: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: cores.tinta,
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra destacada
    shadowColor: cores.tinta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  icone: {
    fontSize: 32,
    color: cores.destaque,
    fontWeight: '300',
    marginTop: -2,
  },
});