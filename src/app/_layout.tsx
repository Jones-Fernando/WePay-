/**
 * WEPAY — LAYOUT PRINCIPAL
 *
 * Agrupa as telas que fazem parte da área interna do aplicativo.
 * A navegação inferior continua seguindo o padrão do projeto de referência;
 * este Stack fornece apenas o agrupamento e a navegação das rotas.
 */

import { Stack } from "expo-router";
import { UsuarioProvider } from "@/contexts/UsuarioContext";

export default function MainLayout() {
  return (
    <UsuarioProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </UsuarioProvider>
  );
}
