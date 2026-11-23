import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/*
 * WEPAY — ESQUECI A SENHA
 * Migrado do projeto de referência para o grupo (auth).
 * Mantém o mesmo padrão visual e fluxo de recuperação.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { authApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function EsqueciSenha() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

  async function enviarRecuperacao() {
    const emailLimpo = email.trim();

    if (!emailLimpo) {
      Alert.alert("Atenção", "Digite seu e-mail.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(emailLimpo)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }

    setCarregando(true);
    try {
      await authApi.esqueciSenha(emailLimpo);
    } catch {
      Alert.alert(
        "Não foi possível solicitar",
        "Não foi possível concluir a solicitação agora. Verifique sua conexão e tente novamente."
      );
      return;
    } finally {
      setCarregando(false);
    }

    Alert.alert(
      "Solicitação recebida",
      "Se o e-mail estiver cadastrado e o serviço de envio estiver disponível, você receberá as instruções para recuperar sua senha.",
      [{ text: "Voltar para o login", onPress: () => router.replace("/(auth)/login") }]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Botão voltar */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>

          {/* Título */}
          <Text style={styles.title}>Esqueceu sua senha?</Text>

          {/* Descrição */}
          <Text style={styles.subtitle}>
            Digite seu e-mail e enviaremos as instruções
            para você criar uma nova senha.
          </Text>

          {/* Formulário */}
          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>

            <TextInput
              style={[
                styles.input,
                focusedField === "email" && styles.focusedField,
              ]}
              placeholder="Digite seu e-mail"
              placeholderTextColor={Cores.textoSuave}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              {...focusHandlers("email")}
              onSubmitEditing={enviarRecuperacao}
            />

            {/* Botão */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={enviarRecuperacao}
              activeOpacity={0.8}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color={Cores.texto} />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar instruções</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Informação */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoIcon}>i</Text>

            <Text style={styles.infoText}>
              Verifique também a pasta de spam ou lixo
              eletrônico caso não encontre o e-mail.
            </Text>
          </View>

          {/* Voltar para login */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>
              Voltar para o login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  keyboard: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 40,
  },

  /* =========================
     VOLTAR
  ========================= */

  backButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 35,
  },

  backIcon: {
    color: Cores.texto,
    fontSize: 32,
    lineHeight: 32,
    marginRight: 6,
  },

  backText: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "600",
  },

  /* =========================
     LOGO
  ========================= */

  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: Cores.sombra,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  logoText: {
    color: Cores.textoSobrePrincipal,
    fontSize: 30,
    fontWeight: "700",
  },

  /* =========================
     TÍTULO
  ========================= */

  title: {
    color: Cores.texto,
    fontSize: 25,
    fontWeight: "600",
    marginTop: 22,
    textAlign: "center",
  },

  subtitle: {
    color: Cores.textoSuave,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    textAlign: "center",
    maxWidth: 340,
  },

  /* =========================
     FORMULÁRIO
  ========================= */

  form: {
    width: "100%",
    marginTop: 32,
  },

  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: Cores.fundoCampo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
    fontSize: 14,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },

  /* =========================
     BOTÃO
  ========================= */

  primaryButton: {
    height: 52,
    backgroundColor: Cores.principal,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  primaryButtonText: {
    color: Cores.textoSobrePrincipal,
    fontSize: 15,
    fontWeight: "700",
  },

  /* =========================
     INFORMAÇÃO
  ========================= */

  infoContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Cores.fundoCampo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
  },

  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Cores.principal,
    color: Cores.textoSobrePrincipal,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 10,
  },

  infoText: {
    flex: 1,
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
  },

  /* =========================
    LOGIN
  ========================= */

  loginButton: {
    marginTop: 25,
    paddingVertical: 10,
  },

  loginText: {
    color: Cores.textoPositivo,
    fontSize: 13,
    fontWeight: "700",
  },
});
