/**
 * WEPAY — ENTRADA DO APP
 *
 * Com a arquitetura atual, index.tsx não é mais a tela de login.
 * Ele funciona como ponto de entrada e leva o usuário ao fluxo de autenticação.
 *
 * A sessão restaurada determina o destino; falhas de conexão permitem tentar
 * novamente sem descartar as credenciais locais.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useUsuario } from "@/contexts/UsuarioContext";

export default function Index() {
  const { usuario, carregando, erroRestauracao, restaurarSessao } = useUsuario();

  if (carregando) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator color="#00C896" />
      </View>
    );
  }

  if (erroRestauracao) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Não foi possível conectar</Text>
        <Text style={styles.message}>{erroRestauracao}</Text>
        <Pressable style={styles.button} onPress={() => void restaurarSessao()}>
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return <Redirect href={usuario ? "/(main)/home" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F5FBF7",
  },
  title: {
    color: "#0B3B33",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#6B8F86",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  button: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00C896",
    borderRadius: 14,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  buttonText: {
    color: "#0B3B33",
    fontWeight: "700",
  },
});
