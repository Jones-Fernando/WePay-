import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import { router } from "expo-router";

export default function LerRecibo() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => router.back()}
          >
            <Text style={styles.iconeVoltar}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.titulo}>Ler recibo</Text>

          <View style={styles.espaco} />
        </View>

        <View style={styles.card}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.texto}>Funcionalidade de leitura de recibo</Text>
          <Text style={styles.subtexto}>
            Em desenvolvimento. Aqui será integrada a IA para ler o comprovante.
          </Text>

          <TouchableOpacity
            style={styles.botao}
            onPress={() =>
              Alert.alert("Recibo", "Leitura do recibo em desenvolvimento.")
            }
          >
            <Text style={styles.botaoTexto}>Simular leitura</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 18,
  },
  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },
  iconeVoltar: {
    fontSize: 32,
    color: "#0B3B33",
    lineHeight: 34,
    marginTop: -3,
  },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3B33",
  },
  espaco: {
    width: 42,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  texto: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3B33",
    textAlign: "center",
  },
  subtexto: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B8F86",
    textAlign: "center",
    lineHeight: 20,
  },
  botao: {
    marginTop: 24,
    backgroundColor: "#00C896",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  botaoTexto: {
    color: "#0B3B33",
    fontWeight: "700",
  },
});
