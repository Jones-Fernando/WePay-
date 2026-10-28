import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { participantesApi } from "@/services/api";

export default function ConviteParticipante() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviarConvite() {
    const emailLimpo = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      Alert.alert("E-mail inválido", "Informe um endereço de e-mail válido.");
      return;
    }

    if (!Number.isInteger(Number(groupId)) || enviando) return;
    try {
      setEnviando(true);
      await participantesApi.convidar(Number(groupId), emailLimpo);
      Alert.alert("Convite enviado", "O convite foi enviado para o e-mail informado.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível enviar o convite.");
    } finally { setEnviando(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
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
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="pessoa@exemplo.com"
          placeholderTextColor="#8AA69E"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
        />

        <TouchableOpacity style={styles.botao} onPress={enviarConvite} disabled={enviando}>
          <Text style={styles.botaoTexto}>{enviando ? "Enviando..." : "Enviar convite"}</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { padding: 22, flex: 1 },
  voltar: { color: "#0B3B33", fontSize: 14, fontWeight: "700" },
  icone: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#DDF7EE", alignItems: "center", justifyContent: "center", marginTop: 36, marginBottom: 20 },
  titulo: { color: "#0B3B33", fontSize: 24, fontWeight: "800" },
  subtitulo: { color: "#6B8F86", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 28 },
  label: { color: "#0B3B33", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { height: 53, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 13, paddingHorizontal: 14, color: "#0B3B33", fontSize: 14 },
  botao: { height: 52, backgroundColor: "#00C896", borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 18 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  aviso: { color: "#6B8F86", fontSize: 11, lineHeight: 17, marginTop: 18 },
});
