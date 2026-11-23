import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import CalendarioData from "@/components/CalendarioData";
import { IconeCategoria } from "@/components/IconeCategoria";
import { despesasPessoaisApi } from "@/services/api";
import {
  formatCurrencyInput,
  formatDateForInput,
  parseCurrencyInput,
  parseDateInputToIso,
} from "@/utils/financeInput";
import { CATEGORIAS_PESSOAIS as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { Alert } from "@/services/feedback";

export default function NovaDespesaPessoal() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("pessoal", CATEGORIAS);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [campoFocado, setCampoFocado] = useState<"descricao" | "valor" | null>(null);
  const [data, setData] = useState(() => formatDateForInput(new Date()));
  const [categoria, setCategoria] = useState("Alimentação");
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorData, setMostrarSeletorData] = useState(false);

  function abrirCalendario() {
    setMostrarSeletorData(true);
  }

  function selecionarData(dataSelecionada: string) {
    setData(dataSelecionada);
    setMostrarSeletorData(false);
  }

  async function salvarDespesa() {
    const desc = descricao.trim();
    if (!desc) { Alert.alert("Atenção", "Digite a descrição."); return; }
    const valorNum = parseCurrencyInput(valor);
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert("Atenção", "Digite um valor válido."); return; }
    const dataIso = parseDateInputToIso(data.trim());
    if (!dataIso) { Alert.alert("Atenção", "Digite uma data válida no formato DD/MM/AAAA."); return; }
    const [ano, mes, dia] = dataIso.split("-").map(Number);
    const dataInformada = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dataInformada > hoje) {
      Alert.alert("Atenção", "A data da despesa não pode ser futura.");
      return;
    }

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
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Nova despesa pessoal</Text>
              <Text style={styles.subtitulo}>Seu controle financeiro pessoal</Text>
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
            <TextInput
              style={[
                styles.input,
                campoFocado === "descricao" && styles.campoFocado,
              ]}
              placeholder="Ex.: Mercado"
              placeholderTextColor={Cores.placeholder}
              value={descricao}
              onChangeText={setDescricao}
              onFocus={() => setCampoFocado("descricao")}
              onBlur={() =>
                setCampoFocado((campo) => campo === "descricao" ? null : campo)
              }
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Valor</Text>
            <View
              style={[
                styles.valorContainer,
                campoFocado === "valor" && styles.campoFocado,
              ]}
            >
              <Text style={styles.simbolo}>R$</Text>
              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor={Cores.placeholder}
                value={valor}
                onChangeText={(texto) => setValor(formatCurrencyInput(texto))}
                onFocus={() => setCampoFocado("valor")}
                onBlur={() =>
                  setCampoFocado((campo) => campo === "valor" ? null : campo)
                }
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              testID="date-selector"
              style={styles.seletorData}
              onPress={abrirCalendario}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Data ${data}. Abrir calendário`}
            >
              <Text style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}>{data || "Escolher data"}</Text>
              <Feather
                name="calendar"
                size={16}
                color={Cores.textoSuave}
                accessible={false}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 10 }}>
              {categorias.map((item) => (
                <TouchableOpacity key={item.nome} style={[styles.categoria, categoria === item.nome && styles.categoriaSelecionada]} onPress={() => setCategoria(item.nome)} activeOpacity={0.8}>
                  <IconeCategoria icone={item.icone} tamanho={15} style={{ marginRight: 5 }} />
                  <Text style={[styles.categoriaTexto, categoria === item.nome && { color: Cores.texto }]}>{item.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {erroCategorias && <Text style={styles.erroCategorias}>{erroCategorias}</Text>}
          </View>

          <TouchableOpacity style={[styles.botaoSalvar, salvando && { opacity: 0.6 }]} onPress={salvarDespesa} disabled={salvando} activeOpacity={0.85}>
            {salvando ? <ActivityIndicator color={Cores.textoSobrePrincipal} /> : <Text style={styles.botaoSalvarTexto}>Salvar despesa</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoCancelar} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {mostrarSeletorData && (
        <CalendarioData
          value={data}
          onClose={() => setMostrarSeletorData(false)}
          onSelectDate={selecionarData}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 22 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, justifyContent: "center", alignItems: "center", marginRight: 12 },
  voltar: { fontSize: 32, color: Cores.texto, marginTop: -3 },
  titulo: { fontSize: 22, fontWeight: "700", color: Cores.texto },
  subtitulo: { fontSize: 12, color: Cores.textoSuave, marginTop: 4 },
  cardIA: { flexDirection: "row", alignItems: "center", backgroundColor: Cores.superficieVerde, borderWidth: 1, borderColor: Cores.bordaDestaque, borderRadius: 16, padding: 14, marginBottom: 24 },
  iconeIA: { width: 44, height: 44, borderRadius: 14, backgroundColor: Cores.cartaoFundo, justifyContent: "center", alignItems: "center", marginRight: 12 },
  iaTitulo: { fontSize: 14, fontWeight: "700", color: Cores.texto, marginBottom: 3 },
  iaSubtitulo: { fontSize: 10, color: Cores.textoSuave, lineHeight: 15 },
  seta: { fontSize: 25, color: Cores.textoPositivo, marginLeft: 8 },
  campo: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: Cores.texto, marginBottom: 8 },
  input: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 15, fontSize: 14, color: Cores.texto, outlineStyle: "solid", outlineWidth: 0 },
  campoFocado: { borderWidth: 2, borderColor: Cores.textoPositivo },
  seletorData: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textoSeletorData: { fontSize: 14, color: Cores.texto },
  placeholderSeletorData: { color: Cores.placeholder },
  valorContainer: { height: 52, flexDirection: "row", alignItems: "center", backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 15 },
  simbolo: { fontSize: 14, color: Cores.texto, marginRight: 8 },
  inputValor: { flex: 1, height: "100%", fontSize: 14, color: Cores.texto, borderRadius: 12, outlineStyle: "solid", outlineWidth: 0 },
  categoria: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda },
  erroCategorias: { color: Cores.textoNegativo, fontSize: 12, marginTop: 6 },
  categoriaSelecionada: { backgroundColor: Cores.superficieVerdeSelecionada, borderColor: Cores.principal },
  categoriaTexto: { fontSize: 11, color: Cores.textoSuave, fontWeight: "600" },
  botaoSalvar: { height: 54, backgroundColor: Cores.principal, borderRadius: 15, justifyContent: "center", alignItems: "center", marginTop: 4 },
  botaoSalvarTexto: { fontSize: 15, fontWeight: "700", color: Cores.textoSobrePrincipal },
  botaoCancelar: { height: 48, justifyContent: "center", alignItems: "center", marginTop: 5 },
  botaoCancelarTexto: { fontSize: 13, fontWeight: "600", color: Cores.textoSuave },
});
