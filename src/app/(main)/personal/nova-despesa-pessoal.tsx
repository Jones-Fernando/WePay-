import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { despesasPessoaisApi } from "@/services/api";

const CATEGORIAS = [
  { nome: "Alimentação", icone: "🍽️" },
  { nome: "Transporte", icone: "🚕" },
  { nome: "Casa", icone: "🏠" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Assinatura", icone: "🎬" },
  { nome: "Outros", icone: "📦" },
];

function converterValor(v: string) {
  const limpo = v.replace(/R\$/gi, "").replace(/\s/g, "");
  if (limpo.includes(",") && limpo.includes("."))
    return Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number(limpo.replace(",", "."));
}

function converterDataParaIso(data: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getFullYear() !== Number(ano) || d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) return null;
  return `${ano}-${mes}-${dia}`;
}

export default function NovaDespesaPessoal() {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [salvando, setSalvando] = useState(false);

  async function salvarDespesa() {
    const desc = descricao.trim();
    if (!desc) { Alert.alert("Atenção", "Digite a descrição."); return; }
    const valorNum = converterValor(valor);
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert("Atenção", "Digite um valor válido."); return; }
    const dataIso = converterDataParaIso(data.trim());
    if (!dataIso) { Alert.alert("Atenção", "Digite uma data válida no formato DD/MM/AAAA."); return; }

    setSalvando(true);
    try {
      await despesasPessoaisApi.criar({ descricao: desc, valor: valorNum, categoria, tipo: "despesa", data_despesa: dataIso });
      Alert.alert("Despesa salva", "Cadastrada com sucesso.", [
        { text: "OK", onPress: () => router.replace("/(main)/personal/despesas-pessoais") },
      ]);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Nova despesa pessoal</Text>
              <Text style={styles.subtitulo}>Fora dos grupos — só seu controle</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cardIA} activeOpacity={0.85} onPress={() => router.push("/(main)/receipt-reader/ler-recibo")}>
            <View style={styles.iconeIA}><Text style={{ fontSize: 21 }}>📷</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.iaTitulo}>Ler recibo com foto</Text>
              <Text style={styles.iaSubtitulo}>Preencha os dados automaticamente com IA</Text>
            </View>
            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>

          <View style={styles.campo}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput style={styles.input} placeholder="Ex.: Mercado" placeholderTextColor="#8AA69E" value={descricao} onChangeText={setDescricao} autoCapitalize="sentences" />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Valor</Text>
            <View style={styles.valorContainer}>
              <Text style={styles.simbolo}>R$</Text>
              <TextInput style={styles.inputValor} placeholder="0,00" placeholderTextColor="#8AA69E" value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TextInput style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor="#8AA69E" value={data} onChangeText={setData} keyboardType="numbers-and-punctuation" />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 10 }}>
              {CATEGORIAS.map((item) => (
                <TouchableOpacity key={item.nome} style={[styles.categoria, categoria === item.nome && styles.categoriaSelecionada]} onPress={() => setCategoria(item.nome)} activeOpacity={0.8}>
                  <Text style={{ fontSize: 15, marginRight: 5 }}>{item.icone}</Text>
                  <Text style={[styles.categoriaTexto, categoria === item.nome && { color: "#0B3B33" }]}>{item.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={[styles.botaoSalvar, salvando && { opacity: 0.6 }]} onPress={salvarDespesa} disabled={salvando} activeOpacity={0.85}>
            {salvando ? <ActivityIndicator color="#0B3B33" /> : <Text style={styles.botaoSalvarTexto}>Salvar despesa</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoCancelar} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 22 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", justifyContent: "center", alignItems: "center", marginRight: 12 },
  voltar: { fontSize: 32, color: "#0B3B33", marginTop: -3 },
  titulo: { fontSize: 22, fontWeight: "700", color: "#0B3B33" },
  subtitulo: { fontSize: 12, color: "#6B8F86", marginTop: 4 },
  cardIA: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F9F2", borderWidth: 1, borderColor: "#C9EFE1", borderRadius: 16, padding: 14, marginBottom: 24 },
  iconeIA: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  iaTitulo: { fontSize: 14, fontWeight: "700", color: "#0B3B33", marginBottom: 3 },
  iaSubtitulo: { fontSize: 10, color: "#6B8F86", lineHeight: 15 },
  seta: { fontSize: 25, color: "#00A17A", marginLeft: 8 },
  campo: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#0B3B33", marginBottom: 8 },
  input: { height: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 13, paddingHorizontal: 15, fontSize: 14, color: "#0B3B33" },
  valorContainer: { height: 52, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 13, paddingHorizontal: 15 },
  simbolo: { fontSize: 14, fontWeight: "700", color: "#0B3B33", marginRight: 8 },
  inputValor: { flex: 1, height: "100%", fontSize: 18, color: "#0B3B33" },
  categoria: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8" },
  categoriaSelecionada: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  categoriaTexto: { fontSize: 11, color: "#6B8F86", fontWeight: "600" },
  botaoSalvar: { height: 54, backgroundColor: "#00C896", borderRadius: 15, justifyContent: "center", alignItems: "center", marginTop: 4 },
  botaoSalvarTexto: { fontSize: 15, fontWeight: "700", color: "#0B3B33" },
  botaoCancelar: { height: 48, justifyContent: "center", alignItems: "center", marginTop: 5 },
  botaoCancelarTexto: { fontSize: 13, fontWeight: "600", color: "#6B8F86" },
});
