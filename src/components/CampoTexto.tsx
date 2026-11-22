import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

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
  const cores = useAppTheme();
  const styles = criarEstilos(cores);
  const [focado, setFocado] = useState(false);
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
        onFocus={(event) => {
          setFocado(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocado(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          focado && !erro && styles.inputFocado,
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

const criarEstilos = (cores: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 18,
  },

  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: cores.textoSecundario,
  },

  input: {
    width: '100%',
    minHeight: 54,

    paddingHorizontal: 16,

    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 12,

    backgroundColor: cores.fundoCampo,

    fontSize: 15,
    color: cores.texto,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },

  inputFocado: {
    borderWidth: 2,
    borderColor: cores.textoPositivo,
  },

  /**
   * Aparência aplicada quando existe erro.
   */
  inputErro: {
    borderColor: cores.negativo,
  },
});