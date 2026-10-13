/**
 * WEPAY — ENTRADA DO APP
 *
 * Com a arquitetura atual, index.tsx não é mais a tela de login.
 * Ele funciona como ponto de entrada e leva o usuário ao fluxo de autenticação.
 *
 * Quando o AuthContext/Sessão estiver implementado, este arquivo poderá decidir
 * entre /(auth)/login e /(main)/home com base no estado de autenticação.
 */

import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useUsuario } from "@/contexts/UsuarioContext";

export default function Index() {
  const { usuario, carregando } = useUsuario();

  if (carregando) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color="#00C896" />
      </View>
    );
  }

  return <Redirect href={usuario ? "/(main)/home" : "/(auth)/login"} />;
}
