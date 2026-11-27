/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useAppTheme } from '@/hooks/useAppTheme';

export function useTheme() {
  const cores = useAppTheme();

  return {
    text: cores.texto,
    background: cores.fundo,
    backgroundElement: cores.cartaoFundo,
    backgroundSelected: cores.superficieMintSuave,
    textSecondary: cores.textoSuave,
    primary: cores.principal,
  };
}
