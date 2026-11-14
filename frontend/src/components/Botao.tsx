import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { Cores } from '../constants/Cores';

/**
 * ============================================================
 * PROPRIEDADES DO BOTÃO
 * ============================================================
 */

interface BotaoProps {
  /**
   * Texto mostrado dentro do botão.
   */
  titulo: string;

  /**
   * Função executada quando o botão é pressionado.
   */
  onPress: () => void;

  /**
   * Indica se existe uma operação em andamento.
   */
  carregando?: boolean;

  /**
   * Permite desabilitar o botão.
   */
  disabled?: boolean;
}

/**
 * ============================================================
 * COMPONENTE BOTÃO
 * ============================================================
 */

export default function Botao({
  titulo,
  onPress,
  carregando = false,
  disabled = false,
}: BotaoProps) {
  /**
   * O botão fica desabilitado quando:
   *
   * - o componente recebeu disabled=true
   * - ou quando está carregando
   */
  const botaoDesabilitado =
    disabled || carregando;

  return (
    <Pressable
      onPress={onPress}
      disabled={botaoDesabilitado}
      style={({ pressed }) => [
        styles.botao,

        /**
         * Quando o usuário toca no botão,
         * diminuímos um pouco a opacidade.
         */
        pressed && styles.botaoPressionado,

        /**
         * Durante carregamento o botão fica mais discreto.
         */
        botaoDesabilitado && styles.botaoDesabilitado,
      ]}
    >
      {carregando ? (
        /**
         * ActivityIndicator informa visualmente
         * que existe uma operação em andamento.
         */
        <ActivityIndicator
          size="small"
          color={Cores.branco}
        />
      ) : (
        /**
         * Texto normal do botão.
         */
        <Text style={styles.texto}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * ============================================================
 * ESTILOS
 * ============================================================
 */

const styles = StyleSheet.create({
  botao: {
    width: '100%',
    minHeight: 54,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 12,

    backgroundColor: Cores.principal,
  },

  botaoPressionado: {
    opacity: 0.85,
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  texto: {
    fontSize: 16,
    fontWeight: '800',
    color: Cores.branco,
  },
});