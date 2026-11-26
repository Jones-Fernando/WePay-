import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/*
 * WEPAY — CADASTRO
 * Migrado do projeto de referência para o grupo (auth).
 * Mantém o mesmo padrão visual, validações e navegação.
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
import { router, useLocalSearchParams } from "expo-router";
import { authApi } from "@/services/api";
import { validarSenhaNova } from "@/constants/password";
import { Alert } from "@/services/feedback";

export default function Cadastro() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const conviteToken = Array.isArray(convite) ? convite[0] : convite;
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [campoFocado, setCampoFocado] = useState<
    "nome" | "email" | "senha" | "confirmarSenha" | null
  >(null);

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
    const erroSenha = validarSenhaNova(senha);
    if (erroSenha) {
      Alert.alert("Atenção", erroSenha);
      return;
    }

    setCarregando(true);
    try {
      await authApi.register(nomeLimpo, emailLimpo, senha, conviteToken);
      Alert.alert(
        "Cadastro solicitado",
        "Se esse endereço já tiver uma conta, entre ou use Esqueci minha senha. Caso contrário, sua conta está pronta para login.",
        [{ text: "Ir para o login", onPress: irParaLogin }],
      );
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error ? erro.message : "Não foi possível criar a conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  function irParaLogin() {
    router.replace({
      pathname: "/(auth)/login",
      params: conviteToken ? { convite: conviteToken } : {},
    });
  }

  return (
    <SafeAreaView style={styles.container}>
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
              style={[
                styles.input,
                campoFocado === "nome" && styles.focusedField,
              ]}
              placeholder="Nome completo"
              placeholderTextColor={Cores.textoSuave}
              value={nome}
              onChangeText={setNome}
              onFocus={() => setCampoFocado("nome")}
              onBlur={() =>
                setCampoFocado((campo) => (campo === "nome" ? null : campo))
              }
              autoCapitalize="words"
            />

            {/* E-mail */}
            <TextInput
              style={[
                styles.input,
                campoFocado === "email" && styles.focusedField,
              ]}
              placeholder="E-mail"
              placeholderTextColor={Cores.textoSuave}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setCampoFocado("email")}
              onBlur={() =>
                setCampoFocado((campo) => (campo === "email" ? null : campo))
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Senha */}
            <View
              style={[
                styles.passwordContainer,
                campoFocado === "senha" && styles.focusedField,
              ]}
            >
              <TextInput
                style={styles.passwordInput}
                placeholder="Senha"
                placeholderTextColor={Cores.textoSuave}
                value={senha}
                onChangeText={setSenha}
                onFocus={() => setCampoFocado("senha")}
                onBlur={() =>
                  setCampoFocado((campo) => (campo === "senha" ? null : campo))
                }
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={() =>
                  setMostrarSenha(!mostrarSenha)
                }
                activeOpacity={0.7}
                style={styles.showPasswordButton}
                onFocus={() => setCampoFocado("senha")}
                onBlur={() =>
                  setCampoFocado((campo) => (campo === "senha" ? null : campo))
                }
              >
                <Text style={styles.showPassword}>
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHint}>
              Use pelo menos 6 caracteres, uma letra maiúscula, um número e um símbolo (por exemplo, !, @ ou #). Espaços não contam como símbolo. Senhas mais longas são mais seguras.
            </Text>

            {/* Confirmar senha */}
            <View
              style={[
                styles.passwordContainer,
                campoFocado === "confirmarSenha" && styles.focusedField,
              ]}
            >
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirmar senha"
                placeholderTextColor={Cores.textoSuave}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                onFocus={() => setCampoFocado("confirmarSenha")}
                onBlur={() =>
                  setCampoFocado((campo) =>
                    campo === "confirmarSenha" ? null : campo
                  )
                }
                secureTextEntry={!mostrarConfirmacao}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={() =>
                  setMostrarConfirmacao(!mostrarConfirmacao)
                }
                activeOpacity={0.7}
                style={styles.showPasswordButton}
                onFocus={() => setCampoFocado("confirmarSenha")}
                onBlur={() =>
                  setCampoFocado((campo) =>
                    campo === "confirmarSenha" ? null : campo
                  )
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
                <ActivityIndicator color={Cores.texto} />
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
              onPress={irParaLogin}
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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
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
    color: Cores.texto,
    fontSize: 35,
    fontWeight: "300",
  },

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
    backgroundColor: Cores.fundoCampo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
    fontSize: 14,
    marginBottom: 11,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },

  passwordContainer: {
    height: 52,
    backgroundColor: Cores.fundoCampo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 12,
    marginBottom: 11,
  },

  passwordHint: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 8,
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

  showPasswordButton: {
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  showPassword: {
    color: Cores.textoPositivo,
    fontSize: 11,
    fontWeight: "600",
  },

  primaryButton: {
    height: 52,
    backgroundColor: Cores.principal,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  primaryButtonText: {
    color: Cores.textoSobrePrincipal,
    fontSize: 15,
    fontWeight: "700",
  },

  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
  },

  loginText: {
    color: Cores.textoSuave,
    fontSize: 13,
  },

  loginLink: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 5,
  },

});
