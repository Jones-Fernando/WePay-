import React, { useCallback, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { despesasPessoaisApi, DespesaPessoal } from "@/services/api";

const ICONES: Record<string, string> = {
  Alimentação: "🍽️",
  Transporte: "🚕",
  Casa: "🏠",
  Lazer: "🎮",
  Assinatura: "🎬",
};

function iconeCategoria(categoria: string | null) {
  return categoria ? (ICONES[categoria] ?? "📦") : "📦";
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${Number(dia)} ${meses[Number(mes) - 1]} ${ano}`;
}

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DespesasPessoais() {
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [totalMes, setTotalMes] = useState(0);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [listagem, resumo] = await Promise.all([
        despesasPessoaisApi.listar({ tipo: "despesa" }),
        despesasPessoaisApi.totalMes(),
      ]);
      setDespesas(listagem.data as DespesaPessoal[]);
      setTotalMes(resumo.data.total_despesas ?? 0);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.replace("/(main)/home")}>
          <Text style={styles.iconeVoltar}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTextos}>
          <Text style={styles.titulo}>Despesas pessoais</Text>
          <Text style={styles.subtitulo}>Fora dos grupos — só seu controle</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.cardResumo}>
          <Text style={styles.resumoLabel}>Gasto este mês</Text>
          <Text style={styles.resumoValor}>{formatarValor(totalMes)}</Text>
        </View>

        <View style={styles.listaHeader}>
          <Text style={styles.listaTitulo}>Seus gastos</Text>
          <Text style={styles.listaQuantidade}>{despesas.length}</Text>
        </View>

        {carregando ? (
          <ActivityIndicator color="#00C896" style={{ marginTop: 40 }} />
        ) : despesas.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>Nenhuma despesa registrada.</Text>
          </View>
        ) : (
          despesas.map((d) => (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.85}
              style={styles.recibo}
              onPress={() => router.push({ pathname: "/(main)/personal/detalhes-despesa-pessoal", params: { id: String(d.id) } })}
            >
              <View style={styles.reciboConteudo}>
                <View style={styles.iconeDespesa}>
                  <Text style={styles.iconeTexto}>{iconeCategoria(d.categoria)}</Text>
                </View>
                <View style={styles.informacoes}>
                  <Text style={styles.despesaTitulo}>{d.descricao}</Text>
                  <Text style={styles.despesaInfo}>{d.categoria ?? "Outros"} · {formatarData(d.data_despesa)}</Text>
                </View>
                <Text style={styles.despesaValor}>{formatarValor(Number(d.valor))}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push("/(main)/personal/nova-despesa-pessoal")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5FBF7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 12, borderWidth: 1, borderColor: "#E1EEE8" },
  iconeVoltar: { fontSize: 32, color: "#0B3B33", lineHeight: 34, marginTop: -3 },
  headerTextos: { flex: 1 },
  titulo: { fontSize: 23, fontWeight: "700", color: "#0B3B33" },
  subtitulo: { fontSize: 12, color: "#6B8F86", marginTop: 4 },
  scroll: { flex: 1 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 100 },
  cardResumo: { backgroundColor: "#F0F8F4", borderRadius: 16, padding: 16, marginBottom: 24 },
  resumoLabel: { fontSize: 12, color: "#6B8F86" },
  resumoValor: { marginTop: 8, fontSize: 28, fontWeight: "700", color: "#0B3B33" },
  listaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  listaTitulo: { color: "#0B3B33", fontSize: 15, fontWeight: "700" },
  listaQuantidade: { color: "#6B8F86", fontSize: 12, fontWeight: "700" },
  recibo: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E1EEE8", marginBottom: 12 },
  reciboConteudo: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12 },
  iconeDespesa: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EAF7F3", justifyContent: "center", alignItems: "center" },
  iconeTexto: { fontSize: 18 },
  informacoes: { flex: 1, marginLeft: 10 },
  despesaTitulo: { color: "#0B3B33", fontSize: 13, fontWeight: "700" },
  despesaInfo: { color: "#6B8F86", fontSize: 10, marginTop: 3 },
  despesaValor: { color: "#0B3B33", fontSize: 12, fontWeight: "700" },
  vazio: { paddingTop: 60, alignItems: "center" },
  vazioTexto: { color: "#6B8F86", fontSize: 14 },
  fab: { position: "absolute", right: 20, bottom: 82, width: 54, height: 54, borderRadius: 18, backgroundColor: "#00C896", alignItems: "center", justifyContent: "center", elevation: 6 },
  fabText: { color: "#0B3B33", fontSize: 28, fontWeight: "600", marginTop: -2 },
});
