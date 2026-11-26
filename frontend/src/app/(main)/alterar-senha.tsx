import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
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
} from "react-native";
import { router } from "expo-router";
import { authApi } from "@/services/api";
import { useUsuario } from "@/contexts/UsuarioContext";
import { validarSenhaNova } from "@/constants/password";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function AlterarSenha() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { logout } = useUsuario();
  const [senhaAtual, setSenhaAtual] =
    useState("");

  const [novaSenha, setNovaSenha] =
    useState("");

  const [confirmacao, setConfirmacao] =
    useState("");
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

  async function salvar() {
    if (!senhaAtual || !novaSenha || !confirmacao) {
      Alert.alert(
        "Atenção",
        "Preencha todos os campos."
      );
      return;
    }

    const erroSenha = validarSenhaNova(novaSenha);
    if (erroSenha) {
      Alert.alert("Atenção", erroSenha);
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
      await logout(false);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      Alert.alert(
        "Senha alterada",
        "Por segurança, todas as sessões foram encerradas. Entre novamente com sua nova senha.",
        [
          {
            text: "Ir para o login",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
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

        <View
          style={[
            styles.passwordContainer,
            focusedField === "senhaAtual" && styles.focusedField,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            {...focusHandlers("senhaAtual")}
            secureTextEntry={!mostrarSenhaAtual}
            placeholder="Digite sua senha atual"
            placeholderTextColor={Cores.textoSuave}
          />
          <TouchableOpacity
            onPress={() => setMostrarSenhaAtual((valor) => !valor)}
            activeOpacity={0.7}
          >
            <Text style={styles.showPassword}>
              {mostrarSenhaAtual ? "Ocultar" : "Mostrar"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          Nova senha
        </Text>

        <View
          style={[
            styles.passwordContainer,
            focusedField === "novaSenha" && styles.focusedField,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            value={novaSenha}
            onChangeText={setNovaSenha}
            {...focusHandlers("novaSenha")}
            secureTextEntry={!mostrarNovaSenha}
            placeholder="Digite a nova senha"
            placeholderTextColor={Cores.textoSuave}
          />
          <TouchableOpacity
            onPress={() => setMostrarNovaSenha((valor) => !valor)}
            activeOpacity={0.7}
          >
            <Text style={styles.showPassword}>
              {mostrarNovaSenha ? "Ocultar" : "Mostrar"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.passwordHint}>
          Use pelo menos 6 caracteres, uma letra maiúscula, um número e um símbolo (por exemplo, !, @ ou #). Espaços não contam como símbolo. Senhas mais longas são mais seguras.
        </Text>

        <Text style={styles.label}>
          Confirmar nova senha
        </Text>

        <View
          style={[
            styles.passwordContainer,
            focusedField === "confirmacao" && styles.focusedField,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            value={confirmacao}
            onChangeText={setConfirmacao}
            {...focusHandlers("confirmacao")}
            secureTextEntry={!mostrarConfirmacao}
            placeholder="Repita a nova senha"
            placeholderTextColor={Cores.textoSuave}
          />
          <TouchableOpacity
            onPress={() => setMostrarConfirmacao((valor) => !valor)}
            activeOpacity={0.7}
          >
            <Text style={styles.showPassword}>
              {mostrarConfirmacao ? "Ocultar" : "Mostrar"}
            </Text>
          </TouchableOpacity>
        </View>

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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
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
    backgroundColor: Cores.cartaoFundo,
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

  passwordContainer: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 12,
  },

  passwordHint: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  passwordInput: {
    flex: 1,
    color: Cores.texto,
    fontSize: 14,
    height: "100%",
    borderRadius: 12,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  showPassword: {
    color: Cores.textoPositivo,
    fontSize: 11,
    fontWeight: "600",
  },
  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
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
    color: Cores.textoSobrePrincipal,
    fontWeight: "700",
    fontSize: 15,
  },
});
