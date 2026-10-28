import React, { useCallback, useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { participantesApi } from "@/services/api";

export default function ParticipantesGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [participantes, setParticipantes] = useState<{ id: string; nome: string; email: string; papel: string; iniciais: string }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!Number.isInteger(Number(groupId))) return;
    let ativo = true;
    participantesApi.listar(Number(groupId)).then(({ data }) => {
      if (!ativo) return;
      setParticipantes(data.map((item) => {
        const nome = item.nome || item.email || "Participante";
        return { id: String(item.id), nome, email: item.email || "", papel: item.papel === "admin" ? "Administrador" : "Participante", iniciais: nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() };
      }));
    }).catch((erro) => { if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os participantes."); });
    return () => { ativo = false; };
  }, [groupId]));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Participantes</Text>
        <Text style={styles.subtitulo}>{grupoNome}</Text>

        <View style={styles.resumo}>
          <Text style={styles.resumoNumero}>{participantes.length}</Text>
          <Text style={styles.resumoTexto}>membros no grupo</Text>
        </View>

        <TouchableOpacity style={styles.convidar}
          onPress={() => router.push({
            pathname: "/(main)/group/convite-participante",
            params: { groupId, grupoNome },
          })}>
          <Text style={styles.convidarTexto}>＋  Convidar participante</Text>
        </TouchableOpacity>

        {participantes.map((pessoa) => (
          <TouchableOpacity key={pessoa.id} style={styles.card} onPress={() => router.push({ pathname: "/(main)/group/participante/[id]", params: { id: pessoa.id, groupId, grupoNome } })}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{pessoa.iniciais}</Text>
            </View>
            <View style={styles.dados}>
              <Text style={styles.nome}>{pessoa.nome}</Text>
              <Text style={styles.email}>{pessoa.email}</Text>
              <Text style={styles.papel}>{pessoa.papel}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { color: "#0B3B33", fontSize: 14, fontWeight: "700", marginBottom: 20 },
  titulo: { color: "#0B3B33", fontSize: 24, fontWeight: "800" },
  subtitulo: { color: "#6B8F86", fontSize: 12, marginTop: 5 },
  resumo: { backgroundColor: "#0B3B33", borderRadius: 18, padding: 19, marginTop: 22, marginBottom: 14 },
  resumoNumero: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  resumoTexto: { color: "#BFE0D6", fontSize: 12, marginTop: 4 },
  convidar: { minHeight: 51, backgroundColor: "#00C896", borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  convidarTexto: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E1EEE8", padding: 13, marginBottom: 10 },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#DDF7EE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarTexto: { color: "#087F5B", fontSize: 12, fontWeight: "800" },
  dados: { flex: 1 },
  nome: { color: "#0B3B33", fontSize: 13, fontWeight: "800" },
  email: { color: "#6B8F86", fontSize: 10, marginTop: 4 },
  papel: { color: "#087F5B", fontSize: 10, marginTop: 4, fontWeight: "700" },
  chevron: { color: "#00A17A", fontSize: 24 },
  aviso: { color: "#6B8F86", fontSize: 10, textAlign: "center", lineHeight: 16, marginTop: 14 },
});
