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
        <Stack.Screen name="home" />
        <Stack.Screen name="group/despesas-grupo" />
        <Stack.Screen name="group/detalhes-despesa" />
        <Stack.Screen name="group/nova-despesa" />
        <Stack.Screen name="group/participantes" />
        <Stack.Screen name="group/saldos" />
        <Stack.Screen name="personal/despesas-pessoais" />
        <Stack.Screen name="personal/nova-despesa-pessoal" />
        <Stack.Screen name="receipt-reader/ler-recibo" />
        <Stack.Screen name="gerenciamento-perfil" />
      </Stack>
    </UsuarioProvider>
  );
}
