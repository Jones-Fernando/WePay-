/*
 * WEPAY — CONFIGURAÇÕES
 *
 * Configurações previstas:
 * - Notificações
 * - Tema
 * - Privacidade
 * - Exclusão de conta
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router";

import { Cores } from "../../constants/Cores";

export default function Configuracoes() {
  const [notificacoes, setNotificacoes] =
    useState(true);

  const [som, setSom] =
    useState(true);

  const [tema, setTema] =
    useState("Sistema");

  function excluirConta() {
    Alert.alert(
      "Excluir conta",
      "Esta ação será permanente quando integrada ao backend.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Continuar",
          style: "destructive",
        },
      ]
    );
  }

  function selecionarTema() {
    Alert.alert(
      "Tema",
      "Escolha o tema do aplicativo.",
      [
        {
          text: "Sistema",
          onPress: () => setTema("Sistema"),
        },
        {
          text: "Claro",
          onPress: () => setTema("Claro"),
        },
        {
          text: "Escuro",
          onPress: () => setTema("Escuro"),
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            Configurações
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.sectionTitle}>
          Notificações
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                Notificações
              </Text>

              <Text style={styles.rowDescription}>
                Receber alertas importantes do aplicativo.
              </Text>
            </View>

            <Switch
              value={notificacoes}
              onValueChange={setNotificacoes}
              trackColor={{
                false: Cores.borda,
                true: Cores.principal,
              }}
              thumbColor={Cores.branco}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                Sons
              </Text>

              <Text style={styles.rowDescription}>
                Ativar sons das notificações.
              </Text>
            </View>

            <Switch
              value={som}
              onValueChange={setSom}
              trackColor={{
                false: Cores.borda,
                true: Cores.principal,
              }}
              thumbColor={Cores.branco}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Aparência
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={selecionarTema}
        >
          <View>
            <Text style={styles.rowTitle}>
              Tema
            </Text>

            <Text style={styles.rowDescription}>
              {tema}
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Privacidade e conta
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => Alert.alert(
            "Privacidade",
            "A política de privacidade será apresentada aqui."
          )}
        >
          <Text style={styles.rowTitle}>
            Privacidade
          </Text>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteCard}
          onPress={excluirConta}
        >
          <Text style={styles.deleteTitle}>
            Excluir minha conta
          </Text>

          <Text style={styles.deleteDescription}>
            Essa ação removerá sua conta permanentemente.
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    color: Cores.texto,
    fontSize: 32,
  },

  title: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  sectionTitle: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 25,
    marginBottom: 10,
  },

  card: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 16,
    paddingHorizontal: 15,
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  rowContent: {
    flex: 1,
    paddingRight: 12,
  },

  rowTitle: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "600",
  },

  rowDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  separator: {
    height: 1,
    backgroundColor: Cores.borda,
  },

  optionCard: {
    minHeight: 60,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  arrow: {
    color: Cores.textoSuave,
    fontSize: 22,
  },

  deleteCard: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.negativo,
    borderRadius: 14,
    padding: 16,
    marginTop: 15,
  },

  deleteTitle: {
    color: Cores.negativo,
    fontSize: 14,
    fontWeight: "700",
  },

  deleteDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
});