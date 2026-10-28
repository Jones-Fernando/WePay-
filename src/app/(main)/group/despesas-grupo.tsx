
import React, { useCallback, useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasGrupoApi } from "@/services/api";

export default function DespesasGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [filtro, setFiltro] = useState("Todas");
  const [despesas, setDespesas] = useState<{ id: string; descricao: string; categoria: string; valor: number; pagador: string; data: string; icone: string }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!Number.isInteger(Number(groupId))) return;
    let ativo = true;
    despesasGrupoApi.listar(Number(groupId)).then(({ data }) => {
      if (!ativo) return;
      setDespesas(data.map((item) => ({
        id: String(item.id), descricao: item.descricao, categoria: item.categoria || "Outros",
        valor: Number(item.valor), pagador: item.pagador_nome || "Participante",
        data: new Date(item.data_despesa.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR"), icone: "💳",
      })));
    }).catch((erro) => { if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar as despesas."); });
    return () => { ativo = false; };
  }, [groupId]));

  const despesasExibidas =
    filtro === "Recentes"
      ? despesas.slice(0, 2)
      : despesas;

  const total = despesas.reduce((soma, item) => soma + item.valor, 0);

  function abrirDespesa(id: string) {
    router.push({
      pathname: "/(main)/group/detalhes-despesa",
      params: { id, groupId, grupoNome },
    });
  }

  function abrirNovaDespesa() {
    router.push({
      pathname: "/(main)/group/nova-despesa",
      params: { groupId, grupoNome },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}>

        <View style={styles.cabecalho}>
          <TouchableOpacity style={styles.voltar} onPress={() => router.back()}>
            <Text style={styles.voltarTexto}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Despesas do grupo</Text>
            <Text style={styles.subtitulo}>{grupoNome}</Text>
          </View>
          <TouchableOpacity style={styles.iconeAcao}
            onPress={() => router.push({
              pathname: "/(main)/group/participantes",
              params: { groupId, grupoNome },
            })}>
            <Text style={styles.iconeAcaoTexto}>♧</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resumo}>
          <Text style={styles.resumoRotulo}>Total de despesas</Text>
          <Text style={styles.resumoValor}>
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </Text>
          <Text style={styles.resumoNota}>
            {despesas.length} despesas no grupo
          </Text>
        </View>

        <TouchableOpacity style={styles.botaoNovo}
          onPress={abrirNovaDespesa}>
          <Text style={styles.botaoNovoTexto}>＋  Nova despesa</Text>
        </TouchableOpacity>

        <View style={styles.linhaTitulo}>
          <Text style={styles.secaoTitulo}>Movimentações</Text>
          <Text style={styles.quantidade}>{despesasExibidas.length} itens</Text>
        </View>

        <View style={styles.filtros}>
          {["Todas", "Recentes"].map((item) => (
            <TouchableOpacity key={item}
              style={[styles.filtro, filtro === item && styles.filtroAtivo]}
              onPress={() => setFiltro(item)}>
              <Text style={[styles.filtroTexto, filtro === item && styles.filtroTextoAtivo]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {despesasExibidas.map((item) => (
          <TouchableOpacity key={item.id}
            style={styles.cardDespesa}
            onPress={() => abrirDespesa(item.id)}
            activeOpacity={0.8}>
            <View style={styles.iconeDespesa}>
              <Text style={{ fontSize: 23 }}>{item.icone}</Text>
            </View>

            <View style={styles.dadosDespesa}>
              <Text style={styles.descricao}>{item.descricao}</Text>
              <Text style={styles.metadados}>{item.categoria} · {item.data}</Text>
              <Text style={styles.pagador}>Pago por {item.pagador}</Text>
            </View>

            <View style={styles.valorColuna}>
              <Text style={styles.valor}>
                {item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </Text>
              <Text style={styles.seta}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.acoesSecundarias}>
          <TouchableOpacity style={styles.acaoSecundaria}
            onPress={() => router.push({
              pathname: "/(main)/group/participantes",
              params: { groupId, grupoNome },
            })}>
            <Text style={styles.acaoIcone}>👥</Text>
            <Text style={styles.acaoTexto}>Participantes</Text>
            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.acaoSecundaria}
            onPress={() => router.push({
              pathname: "/(main)/group/saldos",
              params: { groupId, grupoNome },
            })}>
            <Text style={styles.acaoIcone}>⚖️</Text>
            <Text style={styles.acaoTexto}>Saldos do grupo</Text>
            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { padding: 20, paddingBottom: 36 },
  cabecalho: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
  voltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", alignItems: "center", justifyContent: "center", marginRight: 12 },
  voltarTexto: { color: "#0B3B33", fontSize: 30, marginTop: -3 },
  titulo: { fontSize: 21, fontWeight: "800", color: "#0B3B33" },
  subtitulo: { fontSize: 12, color: "#6B8F86", marginTop: 4 },
  iconeAcao: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E1F8EE", alignItems: "center", justifyContent: "center" },
  iconeAcaoTexto: { fontSize: 24, color: "#087F5B" },
  resumo: { backgroundColor: "#0B3B33", padding: 20, borderRadius: 20, marginBottom: 16 },
  resumoRotulo: { color: "#BFE0D6", fontSize: 12 },
  resumoValor: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 8 },
  resumoNota: { color: "#BFE0D6", fontSize: 11, marginTop: 5 },
  botaoNovo: { minHeight: 52, backgroundColor: "#00C896", borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 26 },
  botaoNovoTexto: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  linhaTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  secaoTitulo: { color: "#0B3B33", fontSize: 17, fontWeight: "800" },
  quantidade: { color: "#6B8F86", fontSize: 11 },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filtro: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8" },
  filtroAtivo: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  filtroTexto: { color: "#6B8F86", fontSize: 12, fontWeight: "600" },
  filtroTextoAtivo: { color: "#0B3B33" },
  cardDespesa: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E1EEE8", padding: 13, flexDirection: "row", alignItems: "center", marginBottom: 10 },
  iconeDespesa: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#EAF7F3", alignItems: "center", justifyContent: "center", marginRight: 11 },
  dadosDespesa: { flex: 1 },
  descricao: { color: "#0B3B33", fontSize: 13, fontWeight: "700" },
  metadados: { color: "#6B8F86", fontSize: 10, marginTop: 5 },
  pagador: { color: "#6B8F86", fontSize: 10, marginTop: 4 },
  valorColuna: { alignItems: "flex-end", marginLeft: 7 },
  valor: { color: "#0B3B33", fontSize: 12, fontWeight: "800" },
  seta: { color: "#00A17A", fontSize: 24, marginTop: 4 },
  acoesSecundarias: { gap: 10, marginTop: 12 },
  acaoSecundaria: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center" },
  acaoIcone: { fontSize: 20, marginRight: 12 },
  acaoTexto: { flex: 1, color: "#0B3B33", fontWeight: "700", fontSize: 13 },
  aviso: { color: "#6B8F86", fontSize: 10, lineHeight: 16, marginTop: 22, textAlign: "center" },
});
