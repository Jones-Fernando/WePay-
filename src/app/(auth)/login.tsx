/*
 * WEPAY — LOGIN
 * Migrado de src/app/index.tsx para src/app/(auth)/login.tsx.
 * O código visual e o fluxo do projeto de referência foram preservados;
 * somente as rotas foram adaptadas à arquitetura atual.
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
  Alert,
  ActivityIndicator,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { useUsuario } from "@/contexts/UsuarioContext";

export default function Index() {
  const { login } = useUsuario();
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    const emailLimpo = email.trim();
    const senhaDigitada = senha;

    if (!emailLimpo) {
      Alert.alert("Atenção", "Digite seu e-mail.");
      return;
    }
    if (!senhaDigitada) {
      Alert.alert("Atenção", "Digite sua senha.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(emailLimpo)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }

    setCarregando(true);
    try {
      await login(emailLimpo, senhaDigitada);
      if (convite) {
        router.replace(`/convite?token=${encodeURIComponent(convite)}` as never);
      } else {
        router.replace("/(main)/home");
      }
    } catch (erro: any) {
      Alert.alert("Erro", erro?.message ?? "Não foi possível fazer login.");
    } finally {
      setCarregando(false);
    }
  }

  function criarConta() {
    router.push("/(auth)/cadastro");
  }

  function esqueciSenha() {
    router.push("/(auth)/esqueci-senha");
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
          {/* Logo */}
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>

          {/* Título */}
          <Text style={styles.title}>Bem-vindo ao WePay</Text>

          <Text style={styles.subtitle}>
            Faça login e continue organizando suas despesas pessoais e as
            despesas em grupo, tudo num só lugar.
          </Text>

          {/* Formulário */}
          <View style={styles.form}>
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
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
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
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={entrar}
              />

              <TouchableOpacity
                onPress={() => setMostrarSenha((valor) => !valor)}
                activeOpacity={0.7}
              >
                <Text style={styles.showPassword}>
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Esqueci minha senha */}
            <TouchableOpacity
              style={styles.forgotContainer}
              onPress={esqueciSenha}
              activeOpacity={0.7}
            >
              <Text style={styles.forgot}>
                Esqueci minha senha
              </Text>
            </TouchableOpacity>

            {/* Entrar */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={entrar}
              activeOpacity={0.8}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color="#0B3B33" />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divisor */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />

            <Text style={styles.or}>ou</Text>

            <View style={styles.divider} />
          </View>

          {/* Cadastro */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>
              Ainda não tem conta?
            </Text>

            <TouchableOpacity
              onPress={criarConta}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>
                Criar conta
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

  keyboard: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },

  // Logo
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#00C896",
    justifyContent: "center",
    alignItems: "center",
  },

  logoText: {
    color: "#0B3B33",
    fontSize: 30,
    fontWeight: "700",
  },

  // Títulos
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
    lineHeight: 21,
  },

  // Formulário
  form: {
    width: "100%",
    marginTop: 32,
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

  // Senha
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
  },

  passwordInput: {
    flex: 1,
    color: "#0B3B33",
    fontSize: 14,
    height: "100%",
  },

  showPassword: {
    color: "#00A17A",
    fontSize: 11,
    fontWeight: "600",
  },

  // Esqueci senha
  forgotContainer: {
    alignItems: "flex-end",
    marginTop: 9,
  },

  forgot: {
    color: "#00A17A",
    fontSize: 12,
    fontWeight: "600",
  },

  // Botão entrar
  primaryButton: {
    height: 52,
    backgroundColor: "#00C896",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },

  primaryButtonText: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
  },

  // Divisor
  dividerContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E1EEE8",
  },

  or: {
    color: "#6B8F86",
    fontSize: 12,
    marginHorizontal: 10,
  },

  // Cadastro
  registerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  registerText: {
    color: "#6B8F86",
    fontSize: 13,
  },

  registerLink: {
    color: "#0B3B33",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 5,
  },
});
