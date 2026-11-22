/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { CoresPorTema } from '@/constants/Cores';

export const Colors = {
  light: {
    text: CoresPorTema.light.texto,
    background: CoresPorTema.light.fundo,
    backgroundElement: CoresPorTema.light.cartaoFundo,
    backgroundSelected: CoresPorTema.light.superficieVerdeSelecionada,
    textSecondary: CoresPorTema.light.textoSuave,
    primary: CoresPorTema.light.principalEscuro,
  },
  dark: {
    text: CoresPorTema.dark.texto,
    background: CoresPorTema.dark.fundo,
    backgroundElement: CoresPorTema.dark.cartaoFundo,
    backgroundSelected: CoresPorTema.dark.superficieVerdeSelecionada,
    textSecondary: CoresPorTema.dark.textoSuave,
    primary: CoresPorTema.dark.principalEscuro,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
