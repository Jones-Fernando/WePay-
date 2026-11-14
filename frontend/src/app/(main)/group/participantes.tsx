import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, SafeAreaView,
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { participantesApi } from "@/services/api";
import type { Paginacao } from "@/types/api";
import {
  appendUniqueById,
  createPaginationRequestGate,
} from "@/utils/paginationRequestGate";

type ParticipanteLista = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  iniciais: string;
};

export default function ParticipantesGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [participantes, setParticipantes] = useState<ParticipanteLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null);
  const gate = useRef(createPaginationRequestGate()).current;

  const carregar = useCallback(async (mostrarLoading = true) => {
    if (!groupId || Number(groupId) <= 0) {
      setParticipantes([]);
      setPaginacao(null);
      setCarregando(false);
      return;
    }
    gate.activate();
    const generation = gate.beginFirstPage();
    if (mostrarLoading) setCarregando(true);
    else setAtualizando(true);
    try {
      const resposta = await participantesApi.listar(Number(groupId), {
        limit: 50,
        offset: 0,
      });
      if (!gate.isCurrent(generation)) return;
      setParticipantes(resposta.data.map((item) => {
        const nome = item.nome || item.email || "Participante";
        return {
          id: String(item.id),
          nome,
          email: item.email || "",
          papel: item.papel === "admin" ? "Administrador" : "Participante",
          iniciais: nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase(),
        };
      }));
      setPaginacao(resposta.paginacao);
    } catch (erro) {
      if (gate.isCurrent(generation)) {
        Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os participantes.");
      }
    } finally {
      gate.finishFirstPage(generation);
      if (gate.isCurrent(generation)) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, [gate, groupId]);

  const carregarMais = useCallback(async () => {
    if (!paginacao?.has_more) return;
    const ticket = gate.beginNextPage();
    if (!ticket) return;
    setCarregandoMais(true);
    try {
      const resposta = await participantesApi.listar(Number(groupId), {
        limit: paginacao.limit,
        offset: paginacao.offset + paginacao.limit,
      });
      if (!gate.isCurrentPage(ticket)) return;
      const novos = resposta.data.map((item) => {
        const nome = item.nome || item.email || "Participante";
        return {
          id: String(item.id),
          nome,
          email: item.email || "",
          papel: item.papel === "admin" ? "Administrador" : "Participante",
          iniciais: nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase(),
        };
      });
      setParticipantes((atuais) => appendUniqueById(atuais, novos));
      setPaginacao(resposta.paginacao);
    } catch (erro) {
      if (gate.isCurrentPage(ticket)) {
        Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar mais participantes.");
      }
    } finally {
      gate.finishNextPage(ticket);
      if (gate.isCurrent(ticket.generation)) setCarregandoMais(false);
    }
  }, [gate, groupId, paginacao]);

  useFocusEffect(useCallback(() => {
    gate.activate();
    void carregar();
    return () => gate.invalidate();
  }, [carregar, gate]));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={carregando ? [] : participantes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => void carregar(false)}
            tintColor="#00A17A"
          />
        }
        onEndReached={() => void carregarMais()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.voltar}>‹  Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.titulo}>Participantes</Text>
            <Text style={styles.subtitulo}>{grupoNome}</Text>
            <View style={styles.resumo}>
              <Text style={styles.resumoNumero}>{paginacao?.total ?? participantes.length}</Text>
              <Text style={styles.resumoTexto}>membros no grupo</Text>
            </View>
            <TouchableOpacity style={styles.convidar}
              onPress={() => router.push({
                pathname: "/(main)/group/convite-participante",
                params: { groupId, grupoNome },
              })}>
              <Text style={styles.convidarTexto}>＋  Convidar participante</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color="#00A17A" style={styles.estado} />
          ) : (
            <Text style={styles.vazio}>Nenhum participante encontrado.</Text>
          )
        }
        ListFooterComponent={carregandoMais ? (
          <ActivityIndicator color="#00A17A" style={styles.estado} />
        ) : undefined}
        renderItem={({ item: pessoa }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/(main)/group/participante/[id]", params: { id: pessoa.id, groupId, grupoNome } })}>
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
        )}
      />
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
  estado: { marginTop: 32 },
  vazio: { color: "#6B8F86", textAlign: "center", paddingVertical: 28 },
  aviso: { color: "#6B8F86", fontSize: 10, textAlign: "center", lineHeight: 16, marginTop: 14 },
});
