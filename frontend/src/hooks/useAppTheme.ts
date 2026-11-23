import { useColorScheme } from "react-native";

import { CoresPorTema, resolverTema } from "@/constants/Cores";
import { usePreferencias } from "@/contexts/PreferenciasContext";

function useTemaResolvido() {
  const { preferencias } = usePreferencias();
  const esquemaDoSistema = useColorScheme();
  return resolverTema(preferencias.tema, esquemaDoSistema);
}

export function useAppTheme() {
  return CoresPorTema[useTemaResolvido()];
}

export function useAppThemeScheme() {
  return useTemaResolvido();
}
