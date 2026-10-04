import React from 'react';

import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { Cores } from '../constants/Cores';

/**
 * ============================================================
 * PROPRIEDADES DO CAMPO
 * ============================================================
 *
 * O componente recebe as propriedades básicas do TextInput
 * juntamente com algumas propriedades próprias do WEPAY.
 */

interface CampoTextoProps extends TextInputProps {
  /**
   * Texto que aparece acima do campo.
   */
  label: string;

  /**
   * Quando true, o campo recebe aparência de erro.
   */
  erro?: boolean;
}

/**
 * ============================================================
 * COMPONENTE CAMPO TEXTO
 * ============================================================
 *
 * Componente reutilizável para e-mail, senha, nome etc.
 */

export default function CampoTexto({
  label,
  erro = false,
  ...props
}: CampoTextoProps) {
  return (
    <View style={styles.container}>

      {/* ------------------------------------------------------
          LABEL
         ------------------------------------------------------
         Exibe o nome do campo acima do input.
      */}
      <Text style={styles.label}>
        {label}
      </Text>

      {/* ------------------------------------------------------
          INPUT
         ------------------------------------------------------
         O TextInput recebe todas as propriedades enviadas
         pelo componente pai.
      */}
      <TextInput
        {...props}
        style={[
          styles.input,
          erro && styles.inputErro,
          props.style,
        ]}
      />
    </View>
  );
}

/**
 * ============================================================
 * ESTILOS
 * ============================================================
 */

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 18,
  },

  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: Cores.textoSecundario,
  },

  input: {
    width: '100%',
    minHeight: 54,

    paddingHorizontal: 16,

    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,

    backgroundColor: Cores.fundoCampo,

    fontSize: 15,
    color: Cores.texto,
  },

  /**
   * Aparência aplicada quando existe erro.
   */
  inputErro: {
    borderColor: Cores.negativo,
  },
});