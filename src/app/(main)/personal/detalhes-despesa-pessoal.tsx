import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasPessoaisApi, DespesaPessoal } from "@/services/api";

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${Number(dia)} ${meses[Number(mes) - 1]} ${ano}`;
}

export default function DetalhesDespesaPessoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [despesa, setDespesa] = useState<DespesaPessoal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let ativo = true;
    async function carregarDespesa() {
      try {
        const res = await despesasPessoaisApi.buscar(Number(id));
        if (ativo) setDespesa(res.data as DespesaPessoal);
      } catch (e) {
        if (ativo) {
          Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível carregar.");
          router.back();
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregarDespesa();
    return () => { ativo = false; };
  }, [id]));

  function confirmarExclusao() {
    Alert.alert("Excluir despesa", "Deseja realmente excluir esta despesa?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: excluir },
    ]);
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await despesasPessoaisApi.deletar(Number(id));
      router.replace("/(main)/personal/despesas-pessoais");
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível excluir.");
      setExcluindo(false);
    }
  }

  if (carregando) return <SafeAreaView style={styles.container}><ActivityIndicator color="#00C896" style={{ marginTop: 60 }} /></SafeAreaView>;
  if (!despesa) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: "/(main)/personal/editar-despesa-pessoal", params: { id: String(despesa.id) } })}>
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.smallLabel}>DESPESA PESSOAL</Text>
          <Text style={styles.title}>{despesa.descricao}</Text>
          <Text style={styles.value}>R$ {Number(despesa.valor).toFixed(2).replace(".", ",")}</Text>
        </View>

        <View style={styles.details}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Categoria</Text>
            <Text style={styles.rowValue}>{despesa.categoria ?? "Outros"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Data</Text>
            <Text style={styles.rowValue}>{formatarData(despesa.data_despesa)}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Tipo</Text>
            <Text style={styles.rowValue}>{despesa.tipo === "receita" ? "Receita" : "Despesa"}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.deleteButton, excluindo && { opacity: 0.6 }]} onPress={confirmarExclusao} disabled={excluindo}>
          {excluindo ? <ActivityIndicator color="#FF6B5C" /> : <Text style={styles.deleteText}>Excluir despesa</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  scroll: { paddingHorizontal: 20, paddingBottom: 35 },
  header: { height: 65, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", justifyContent: "center", alignItems: "center" },
  backText: { color: "#0B3B33", fontSize: 32 },
  headerTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 17 },
  editText: { color: "#00A17A", fontWeight: "700", fontSize: 13 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 18, padding: 20, marginTop: 15 },
  smallLabel: { color: "#6B8F86", fontSize: 10, fontWeight: "700" },
  title: { color: "#0B3B33", fontSize: 22, fontWeight: "700", marginTop: 8 },
  value: { color: "#00A17A", fontSize: 25, fontWeight: "700", marginTop: 15 },
  details: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 16, paddingHorizontal: 18, marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#E1EEE8" },
  rowLabel: { color: "#6B8F86", fontSize: 13 },
  rowValue: { color: "#0B3B33", fontSize: 13, fontWeight: "600" },
  deleteButton: { height: 52, borderWidth: 1, borderColor: "#FF6B5C", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 25 },
  deleteText: { color: "#FF6B5C", fontWeight: "700" },
});
