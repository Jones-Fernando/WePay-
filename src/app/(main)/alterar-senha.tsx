/*
 * WEPAY — ALTERAR SENHA
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { authApi } from "@/services/api";

import { Cores } from "../../constants/Cores";

export default function AlterarSenha() {
  const [senhaAtual, setSenhaAtual] =
    useState("");

  const [novaSenha, setNovaSenha] =
    useState("");

  const [confirmacao, setConfirmacao] =
    useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!senhaAtual || !novaSenha || !confirmacao) {
      Alert.alert(
        "Atenção",
        "Preencha todos os campos."
      );
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert(
        "Atenção",
        "A nova senha deve possuir pelo menos 6 caracteres."
      );
      return;
    }

    if (novaSenha !== confirmacao) {
      Alert.alert(
        "Atenção",
        "As senhas não são iguais."
      );
      return;
    }

    setSalvando(true);
    try {
      await authApi.alterarSenha(senhaAtual, novaSenha);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      Alert.alert("Senha alterada", "Sua senha foi alterada com sucesso.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível alterar a senha.");
    } finally {
      setSalvando(false);
    }
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
            Alterar senha
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Segurança da conta
          </Text>

          <Text style={styles.infoText}>
            Escolha uma senha forte e não compartilhe
            sua senha com outras pessoas.
          </Text>
        </View>

        <Text style={styles.label}>
          Senha atual
        </Text>

        <TextInput
          style={styles.input}
          value={senhaAtual}
          onChangeText={setSenhaAtual}
          secureTextEntry
          placeholder="Digite sua senha atual"
          placeholderTextColor={Cores.textoSuave}
        />

        <Text style={styles.label}>
          Nova senha
        </Text>

        <TextInput
          style={styles.input}
          value={novaSenha}
          onChangeText={setNovaSenha}
          secureTextEntry
          placeholder="Digite a nova senha"
          placeholderTextColor={Cores.textoSuave}
        />

        <Text style={styles.label}>
          Confirmar nova senha
        </Text>

        <TextInput
          style={styles.input}
          value={confirmacao}
          onChangeText={setConfirmacao}
          secureTextEntry
          placeholder="Repita a nova senha"
          placeholderTextColor={Cores.textoSuave}
        />

        <TouchableOpacity
          style={[styles.primaryButton, salvando && { opacity: 0.6 }]}
          onPress={salvar}
          disabled={salvando}
        >
          <Text style={styles.primaryButtonText}>
            {salvando ? "Salvando..." : "Alterar senha"}
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
    paddingBottom: 35,
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

  infoCard: {
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    padding: 15,
    marginTop: 15,
  },

  infoTitle: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 14,
  },

  infoText: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 20,
  },

  input: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
  },

  primaryButton: {
    height: 52,
    backgroundColor: Cores.principal,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  primaryButtonText: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 15,
  },
});
