import React, { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasPessoaisApi, DespesaPessoal } from "@/services/api";

const CATEGORIAS = ["Alimentação","Transporte","Casa","Lazer","Assinatura","Outros"];

function isoParaBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function brParaIso(data: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getFullYear() !== Number(ano) || d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) return null;
  return `${ano}-${mes}-${dia}`;
}

export default function EditarDespesaPessoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let ativo = true;
    async function carregar() {
      try {
        const res = await despesasPessoaisApi.buscar(Number(id));
        const d = res.data as DespesaPessoal;
        if (!ativo) return;
        setDescricao(d.descricao);
        setValor(Number(d.valor).toFixed(2).replace(".", ","));
        setData(isoParaBr(d.data_despesa));
        setCategoria(d.categoria ?? "Outros");
        setTipo(d.tipo);
      } catch (e) {
        if (ativo) {
          Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível carregar.");
          router.back();
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [id]));

  async function salvar() {
    const desc = descricao.trim();
    if (!desc) { Alert.alert("Atenção", "Informe a descrição."); return; }
    const valorNum = Number(valor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert("Atenção", "Informe um valor válido."); return; }
    const dataIso = brParaIso(data.trim());
    if (!dataIso) { Alert.alert("Atenção", "Informe uma data válida no formato DD/MM/AAAA."); return; }

    setSalvando(true);
    try {
      await despesasPessoaisApi.atualizar(Number(id), { descricao: desc, valor: valorNum, categoria, tipo, data_despesa: dataIso });
      Alert.alert("Despesa atualizada", "As alterações foram salvas.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <SafeAreaView style={styles.container}><ActivityIndicator color="#00C896" style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Editar despesa</Text>
            <View style={{ width: 42 }} />
          </View>

          <Text style={styles.label}>Descrição</Text>
          <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} autoCapitalize="sentences" />

          <Text style={styles.label}>Valor</Text>
          <View style={styles.valueContainer}>
            <Text style={styles.currency}>R$</Text>
            <TextInput style={styles.valueInput} value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
          </View>

          <Text style={styles.label}>Data</Text>
          <TextInput style={styles.input} value={data} onChangeText={setData} placeholder="DD/MM/AAAA" placeholderTextColor="#8AA69E" keyboardType="numbers-and-punctuation" />

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.tipoContainer}>
            {(["despesa", "receita"] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.tipoBotao, tipo === t && styles.tipoBotaoAtivo]} onPress={() => setTipo(t)}>
                <Text style={[styles.tipoTexto, tipo === t && styles.tipoTextoAtivo]}>{t === "despesa" ? "Despesa" : "Receita"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categories}>
            {CATEGORIAS.map((item) => (
              <TouchableOpacity key={item} style={[styles.category, categoria === item && styles.categoryActive]} onPress={() => setCategoria(item)}>
                <Text style={[styles.categoryText, categoria === item && styles.categoryTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.saveButton, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#0B3B33" /> : <Text style={styles.saveButtonText}>Salvar alterações</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { height: 65, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", justifyContent: "center", alignItems: "center" },
  backText: { color: "#0B3B33", fontSize: 32 },
  headerTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 17 },
  label: { color: "#0B3B33", fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  input: { height: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 12, paddingHorizontal: 15, color: "#0B3B33", fontSize: 14 },
  valueContainer: { height: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  currency: { color: "#0B3B33", fontWeight: "700", marginRight: 8 },
  valueInput: { flex: 1, color: "#0B3B33", fontSize: 18 },
  tipoContainer: { flexDirection: "row", gap: 8 },
  tipoBotao: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", justifyContent: "center", alignItems: "center" },
  tipoBotaoAtivo: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  tipoTexto: { color: "#6B8F86", fontWeight: "600", fontSize: 13 },
  tipoTextoAtivo: { color: "#0B3B33" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  category: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8" },
  categoryActive: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  categoryText: { color: "#6B8F86", fontSize: 12, fontWeight: "600" },
  categoryTextActive: { color: "#0B3B33" },
  saveButton: { height: 52, backgroundColor: "#00C896", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 30 },
  saveButtonText: { color: "#0B3B33", fontWeight: "700", fontSize: 15 },
});
