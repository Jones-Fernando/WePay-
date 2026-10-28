/*
 * WEPAY — CADASTRO
 * Migrado do projeto de referência para o grupo (auth).
 * Mantém o mesmo padrão visual, validações e navegação.
 */
import React, { useEffect, useState } from "react";
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
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authApi } from "@/services/api";

export default function Cadastro() {
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [contaCriada, setContaCriada] = useState(false);

  useEffect(() => {
    if (!contaCriada) return;

    const redirecionamento = setTimeout(() => {
      router.replace(convite ? { pathname: "/(auth)/login", params: { convite } } : "/(auth)/login");
    }, 2000);

    return () => clearTimeout(redirecionamento);
  }, [contaCriada, convite]);

  async function criarConta() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo || !emailLimpo || !senha || !confirmarSenha) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(emailLimpo)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert("Erro", "As senhas não são iguais.");
      return;
    }
    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha deve ter ao menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      await authApi.register(nomeLimpo, emailLimpo, senha);
      setContaCriada(true);
    } catch (erro: any) {
      Alert.alert("Erro", erro?.message ?? "Não foi possível criar a conta.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        transparent
        visible={contaCriada}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Conta criada com sucesso!</Text>
            <Text style={styles.successText}>Redirecionando para o login...</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Voltar */}
          <View style={styles.top}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>

          {/* Título */}
          <Text style={styles.title}>
            Crie sua conta
          </Text>

          <Text style={styles.subtitle}>
            Cadastre-se para começar a dividir suas despesas
          </Text>

          {/* Formulário */}
          <View style={styles.form}>
            {/* Nome */}
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#6B8F86"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
            />

            {/* E-mail */}
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#6B8F86"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Senha */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Senha"
                placeholderTextColor="#6B8F86"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
              />

              <TouchableOpacity
                onPress={() =>
                  setMostrarSenha(!mostrarSenha)
                }
              >
                <Text style={styles.showPassword}>
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Confirmar senha */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirmar senha"
                placeholderTextColor="#6B8F86"
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                secureTextEntry={!mostrarConfirmacao}
              />

              <TouchableOpacity
                onPress={() =>
                  setMostrarConfirmacao(!mostrarConfirmacao)
                }
              >
                <Text style={styles.showPassword}>
                  {mostrarConfirmacao ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Botão */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={criarConta}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color="#0B3B33" />
              ) : (
                <Text style={styles.primaryButtonText}>Criar conta</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Já possui uma conta?
            </Text>

            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.loginLink}>
                Entrar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },

  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  top: {
    width: "100%",
    height: 45,
    justifyContent: "center",
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },

  backText: {
    color: "#0B3B33",
    fontSize: 35,
    fontWeight: "300",
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#00C896",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#0B3B33",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  logoText: {
    color: "#0B3B33",
    fontSize: 30,
    fontWeight: "700",
  },

  title: {
    color: "#0B3B33",
    fontSize: 25,
    fontWeight: "600",
    marginTop: 22,
    textAlign: "center",
  },

  subtitle: {
    color: "#6B8F86",
    fontSize: 14,
    marginTop: 7,
    textAlign: "center",
    lineHeight: 20,
  },

  form: {
    width: "100%",
    marginTop: 30,
  },

  input: {
    height: 52,
    backgroundColor: "#F0F8F4",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 12,
    paddingHorizontal: 15,
    color: "#0B3B33",
    fontSize: 14,
    marginBottom: 11,
  },

  passwordContainer: {
    height: 52,
    backgroundColor: "#F0F8F4",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 12,
    marginBottom: 11,
  },

  passwordInput: {
    flex: 1,
    color: "#0B3B33",
    fontSize: 14,
  },

  showPassword: {
    color: "#00A17A",
    fontSize: 11,
    fontWeight: "600",
  },

  primaryButton: {
    height: 52,
    backgroundColor: "#00C896",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  primaryButtonText: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
  },

  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
  },

  loginText: {
    color: "#6B8F86",
    fontSize: 13,
  },

  loginLink: {
    color: "#0B3B33",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 5,
  },

  successOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(11, 59, 51, 0.35)",
    padding: 24,
  },

  successCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    backgroundColor: "#F5FBF7",
    borderRadius: 16,
    padding: 28,
  },

  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00C896",
    marginBottom: 16,
  },

  successIconText: {
    color: "#0B3B33",
    fontSize: 28,
    fontWeight: "700",
  },

  successTitle: {
    color: "#0B3B33",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  successText: {
    color: "#6B8F86",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
