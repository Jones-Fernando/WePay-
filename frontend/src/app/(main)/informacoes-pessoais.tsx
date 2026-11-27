import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useFieldFocus } from "@/hooks/useFieldFocus";
import type { PaletaSemantica } from "@/constants/Cores";
import { useUsuario } from "@/contexts/UsuarioContext";
import { authApi } from "@/services/api";
import { Alert } from "@/services/feedback";

export default function InformacoesPessoaisScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { usuario, atualizarPerfil } = useUsuario();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [chavePix, setChavePix] = useState(usuario?.pixChave ?? "");
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

  async function salvarAlteracoes() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const chavePixLimpa = chavePix.trim();

    if (!nomeLimpo) {
      Alert.alert("Atenção", "Digite seu nome.");
      return;
    }

    if (nomeLimpo.length < 3) {
      Alert.alert("Atenção", "O nome precisa ter pelo menos 3 caracteres.");
      return;
    }

    if (!emailLimpo) {
      Alert.alert("Atenção", "Digite seu e-mail.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(emailLimpo)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }

    if (chavePixLimpa.length > 77) {
      Alert.alert(
        "Chave Pix inválida",
        "A chave Pix deve ter no máximo 77 caracteres.",
      );
      return;
    }

    setSalvando(true);
    try {
      await authApi.atualizarPerfil({
        nome: nomeLimpo,
        email: emailLimpo,
        telefone: usuario?.telefone ?? "",
        pix_chave: chavePixLimpa || null,
      });
      atualizarPerfil({
        nome: nomeLimpo,
        email: emailLimpo,
        pixChave: chavePixLimpa,
      });
      Alert.alert(
        "Perfil atualizado",
        "Suas informações foram atualizadas com sucesso.",
      );
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error
          ? erro.message
          : "Não foi possível atualizar seu perfil.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityLabel="Voltar"
            >
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Informações pessoais</Text>
            <View style={styles.headerSpace} />
          </View>

          <Text style={styles.description}>
            Atualize seu nome, e-mail e chave Pix.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "nome" && styles.focusedField,
              ]}
              value={nome}
              onChangeText={setNome}
              placeholder="Digite seu nome"
              placeholderTextColor={Cores.textoSuave}
              autoCapitalize="words"
              autoCorrect={false}
              {...focusHandlers("nome")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "email" && styles.focusedField,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={Cores.textoSuave}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              {...focusHandlers("email")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Chave Pix para receber</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "chavePix" && styles.focusedField,
              ]}
              value={chavePix}
              onChangeText={setChavePix}
              placeholder="Digite sua chave Pix"
              placeholderTextColor={Cores.textoSuave}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={77}
              {...focusHandlers("chavePix")}
            />
            <Text style={styles.helperText}>
              Opcional. Será mostrada apenas a quem deve a você em um grupo.
            </Text>
          </View>

          <TouchableOpacity
            testID="save-personal-info"
            style={[styles.saveButton, salvando && styles.saveButtonDisabled]}
            onPress={salvarAlteracoes}
            disabled={salvando}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {salvando ? "Salvando..." : "Salvar alterações"}
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
    paddingHorizontal: 20,
    paddingBottom: 35,
  },
  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
    lineHeight: 36,
  },
  title: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpace: {
    width: 42,
  },
  description: {
    color: Cores.textoSuave,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  field: {
    marginTop: 16,
  },
  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    color: Cores.texto,
    fontSize: 14,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },
  helperText: {
    marginTop: 6,
    color: Cores.textoSuave,
    fontSize: 11,
    lineHeight: 16,
  },
  saveButton: {
    minHeight: 52,
    marginTop: 26,
    borderRadius: 12,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Cores.textoSobrePrincipal,
    fontWeight: "700",
    fontSize: 15,
  },
});
