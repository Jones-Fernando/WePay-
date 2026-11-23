/**
 * WEPAY — LAYOUT PRINCIPAL
 *
 * Agrupa as telas que fazem parte da área interna do aplicativo.
 * A navegação inferior continua seguindo o padrão do projeto de referência;
 * este Stack fornece apenas o agrupamento e a navegação das rotas.
 */

import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { UsuarioProvider } from "@/contexts/UsuarioContext";
import { PreferenciasProvider } from "@/contexts/PreferenciasContext";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { useAppThemeScheme } from "@/hooks/useAppTheme";

function AppChrome() {
  const scheme = useAppThemeScheme();

  return (
    <StatusBar
      barStyle={scheme === "dark" ? "light-content" : "dark-content"}
    />
  );
}

export default function MainLayout() {
  return (
    <UsuarioProvider>
      <PreferenciasProvider>
        <ToastProvider>
          <AppChrome />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(main)" />
          </Stack>
        </ToastProvider>
      </PreferenciasProvider>
    </UsuarioProvider>
  );
}
