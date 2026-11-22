import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authApi } from "@/services/api";
import { MIN_PASSWORD_LENGTH, validarSenhaNova } from "@/constants/password";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function RedefinirSenha() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();
  async function redefinir() {
    if (!token || Array.isArray(token)) { Alert.alert("Link inválido", "Solicite uma nova recuperação de senha."); return; }
    const erroSenha = validarSenhaNova(senha);
    if (erroSenha) { Alert.alert("Senha inválida", erroSenha); return; }
    if (senha !== confirmacao) { Alert.alert("Senhas diferentes", "Digite a mesma senha nos dois campos."); return; }
    if (salvando) return;
    try { setSalvando(true); await authApi.redefinirSenha(token, senha); Alert.alert("Senha redefinida", "Agora você já pode entrar com sua nova senha.", [{ text: "Ir para o login", onPress: () => router.replace("/(auth)/login") }]); }
    catch (erro) { Alert.alert("Não foi possível redefinir", erro instanceof Error ? erro.message : "Solicite um novo link."); }
    finally { setSalvando(false); }
  }
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logo}><Text style={styles.logoTexto}>W</Text></View>
      <Text style={styles.titulo}>Criar nova senha</Text>
      <Text style={styles.subtitulo}>Escolha uma senha segura para voltar a acessar sua conta.</Text>
      <View style={styles.form}>
        <Text style={styles.rotulo}>Nova senha</Text>
        <TextInput
          style={[styles.campo, focusedField === "senha" && styles.campoFocado]}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
          placeholderTextColor={Cores.placeholder}
          autoComplete="new-password"
          {...focusHandlers("senha")}
        />
        <Text style={styles.rotulo}>Confirmar nova senha</Text>
        <TextInput
          style={[styles.campo, focusedField === "confirmacao" && styles.campoFocado]}
          value={confirmacao}
          onChangeText={setConfirmacao}
          secureTextEntry
          placeholder="Repita a nova senha"
          placeholderTextColor={Cores.placeholder}
          autoComplete="new-password"
          onSubmitEditing={redefinir}
          {...focusHandlers("confirmacao")}
        />
        <TouchableOpacity style={[styles.botao, salvando && styles.desabilitado]} disabled={salvando} onPress={redefinir}>
          <Text style={styles.botaoTexto}>{salvando ? "Salvando..." : "Redefinir senha"}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.voltar} onPress={() => router.replace("/(auth)/login")}>
        <Text style={styles.voltarTexto}>Voltar para o login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo, padding: 24, justifyContent: "center" },
  logo: { width: 62, height: 62, borderRadius: 16, backgroundColor: Cores.principal, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  logoTexto: { fontSize: 29, fontWeight: "800", color: Cores.textoSobrePrincipal },
  titulo: { fontSize: 25, fontWeight: "800", color: Cores.texto, textAlign: "center", marginTop: 24 },
  subtitulo: { fontSize: 14, color: Cores.textoSuave, lineHeight: 21, textAlign: "center", marginTop: 9 },
  form: { marginTop: 28 },
  rotulo: { fontWeight: "700", color: Cores.texto, marginTop: 14, marginBottom: 7 },
  campo: { minHeight: 52, borderRadius: 12, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, paddingHorizontal: 14, color: Cores.texto, outlineStyle: "solid", outlineWidth: 0 },
  campoFocado: { borderWidth: 2, borderColor: Cores.textoPositivo },
  botao: { minHeight: 53, borderRadius: 14, backgroundColor: Cores.principalEscuro, alignItems: "center", justifyContent: "center", marginTop: 28 },
  botaoTexto: { color: Cores.textoSobreMarca, fontWeight: "800", fontSize: 15 },
  desabilitado: { opacity: 0.65 },
  voltar: { alignItems: "center", marginTop: 15 },
  voltarTexto: { color: Cores.textoPositivo, fontWeight: "700" },
});
