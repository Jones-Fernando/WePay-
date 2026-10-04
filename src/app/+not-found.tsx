/**
 * WEPAY — ROTA NÃO ENCONTRADA
 */

import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página não encontrada" }} />
      <View style={styles.container}>
        <Text style={styles.titulo}>Página não encontrada</Text>
        <Text style={styles.texto}>A rota acessada não existe no WEPAY.</Text>
        <Link href="/(auth)/login" style={styles.link}>
          Voltar para o login
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F5FBF7",
  },
  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3B33",
  },
  texto: {
    marginTop: 8,
    textAlign: "center",
    color: "#6B8F86",
  },
  link: {
    marginTop: 18,
    color: "#00A17A",
    fontWeight: "700",
  },
});
