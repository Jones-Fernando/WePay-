import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/**
 * WEPAY — ROTA NÃO ENCONTRADA
 */

import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: Cores.fundo,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: Cores.texto,
  },
  texto: {
    marginTop: 8,
    textAlign: "center",
    color: Cores.textoSuave,
  },
  link: {
    marginTop: 18,
    color: Cores.textoPositivo,
    fontWeight: "700",
  },
});
