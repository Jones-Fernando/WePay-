import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { participantesApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function ConviteParticipante() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

  async function enviarConvite() {
    const emailLimpo = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      Alert.alert("E-mail inválido", "Informe um endereço de e-mail válido.");
      return;
    }

    if (!Number.isInteger(Number(groupId)) || enviando) return;
    try {
      setEnviando(true);
      const resposta = await participantesApi.convidar(Number(groupId), emailLimpo);
      Alert.alert(
        "Convite enviado",
        resposta.message ?? resposta.mensagem ?? "O convite foi criado com sucesso.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível enviar o convite.");
    } finally { setEnviando(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <View style={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>‹  Voltar</Text>
        </TouchableOpacity>

        <View style={styles.icone}>
          <Text style={{ fontSize: 28 }}>✉️</Text>
        </View>
        <Text style={styles.titulo}>Convidar participante</Text>
        <Text style={styles.subtitulo}>
          Adicione alguém para compartilhar as despesas de {grupoNome}.
        </Text>

        <Text style={styles.label}>E-mail do participante</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "email" && styles.focusedField,
          ]}
          value={email}
          onChangeText={setEmail}
          placeholder="pessoa@exemplo.com"
          placeholderTextColor={Cores.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          {...focusHandlers("email")}
        />

        <TouchableOpacity style={styles.botao} onPress={enviarConvite} disabled={enviando}>
          <Text style={styles.botaoTexto}>{enviando ? "Enviando..." : "Enviar convite"}</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  conteudo: { padding: 22, flex: 1 },
  voltar: { color: Cores.texto, fontSize: 14, fontWeight: "700" },
  icone: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 36, marginBottom: 20 },
  titulo: { color: Cores.texto, fontSize: 24, fontWeight: "800" },
  subtitulo: { color: Cores.textoSuave, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 28 },
  label: { color: Cores.texto, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { height: 53, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 14, color: Cores.texto, fontSize: 14, outlineStyle: "solid", outlineWidth: 0 },
  focusedField: { borderWidth: 2, borderColor: Cores.textoPositivo },
  botao: { height: 52, backgroundColor: Cores.principal, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 18 },
  botaoTexto: { color: Cores.textoSobreAcao, fontWeight: "800", fontSize: 14 },
  aviso: { color: Cores.textoSuave, fontSize: 11, lineHeight: 17, marginTop: 18 },
});
