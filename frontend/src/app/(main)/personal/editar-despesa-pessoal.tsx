import React, { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { despesasPessoaisApi } from "@/services/api";
import { CATEGORIAS_PESSOAIS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import {
  formatDateForInput,
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToDate,
  parseDateInputToIso,
} from "@/utils/financeInput";

type CampoFormulario = "descricao" | "valor" | "data";

export default function EditarDespesaPessoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("pessoal", CATEGORIAS_PESSOAIS);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorData, setMostrarSeletorData] = useState(false);
  const [camposVisitados, setCamposVisitados] = useState<Record<CampoFormulario, boolean>>({
    descricao: false,
    valor: false,
    data: false,
  });
  const [erros, setErros] = useState<Record<CampoFormulario, string | null>>({
    descricao: null,
    valor: null,
    data: null,
  });

  function selecionarData(_evento: DateTimePickerEvent, dataSelecionada?: Date) {
    setMostrarSeletorData(false);
    if (dataSelecionada) {
      const novaData = formatDateForInput(dataSelecionada);
      setData(novaData);
      setCamposVisitados((atuais) => ({ ...atuais, data: true }));
      setErros((atuais) => ({ ...atuais, data: validarCampo("data", novaData) }));
    }
  }

  function validarCampo(campo: CampoFormulario, valorCampo: string): string | null {
    if (campo === "descricao") {
      return valorCampo.trim() ? null : "Informe a descrição.";
    }
    if (campo === "valor") {
      const numero = parseCurrencyInput(valorCampo);
      return Number.isFinite(numero) && numero > 0 ? null : "Informe um valor maior que zero.";
    }
    const dataIso = parseDateInputToIso(valorCampo.trim());
    if (!dataIso) return "Informe uma data válida no formato DD/MM/AAAA.";
    const [ano, mes, dia] = dataIso.split("-").map(Number);
    const dataInformada = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return dataInformada > hoje ? "A data não pode ser futura." : null;
  }

  function atualizarCampo(campo: CampoFormulario, valorCampo: string) {
    if (campo === "descricao") setDescricao(valorCampo);
    if (campo === "valor") setValor(valorCampo);
    if (campo === "data") setData(valorCampo);
    if (camposVisitados[campo]) {
      setErros((atuais) => ({ ...atuais, [campo]: validarCampo(campo, valorCampo) }));
    }
  }

  function visitarCampo(campo: CampoFormulario, valorCampo: string) {
    setCamposVisitados((atuais) => ({ ...atuais, [campo]: true }));
    setErros((atuais) => ({ ...atuais, [campo]: validarCampo(campo, valorCampo) }));
  }

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let ativo = true;
    async function carregar() {
      try {
        const res = await despesasPessoaisApi.buscar(Number(id));
        const d = res.data;
        if (!ativo) return;
        setCamposVisitados({ descricao: false, valor: false, data: false });
        setErros({ descricao: null, valor: null, data: null });
        setDescricao(d.descricao);
        setValor(Number(d.valor).toFixed(2).replace(".", ","));
        setData(normalizeDateInput(d.data_despesa));
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
    const valorNum = parseCurrencyInput(valor);
    const dataIso = parseDateInputToIso(data.trim());
    const novosErros = {
      descricao: validarCampo("descricao", descricao),
      valor: validarCampo("valor", valor),
      data: validarCampo("data", data),
    };
    setCamposVisitados({ descricao: true, valor: true, data: true });
    setErros(novosErros);
    if (Object.values(novosErros).some(Boolean) || !dataIso) {
      return;
    }

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
          <TextInput style={[styles.input, erros.descricao && styles.inputComErro]}
            value={descricao} onChangeText={(texto) => atualizarCampo("descricao", texto)}
            onBlur={() => visitarCampo("descricao", descricao)} autoCapitalize="sentences" />
          {erros.descricao && <Text style={styles.erroCampo}>{erros.descricao}</Text>}

          <Text style={styles.label}>Valor</Text>
          <View style={styles.valueContainer}>
            <Text style={styles.currency}>R$</Text>
            <TextInput style={styles.valueInput} value={valor}
              onChangeText={(texto) => atualizarCampo("valor", texto)}
              onBlur={() => visitarCampo("valor", valor)} keyboardType="decimal-pad" />
          </View>
          {erros.valor && <Text style={styles.erroCampo}>{erros.valor}</Text>}

          <Text style={styles.label}>Data</Text>
          <TouchableOpacity style={[styles.seletorData, erros.data && styles.inputComErro]}
            onPress={() => setMostrarSeletorData(true)} activeOpacity={0.8}>
            <Text style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}>{data || "Escolher data"}</Text>
          </TouchableOpacity>
          {erros.data && <Text style={styles.erroCampo}>{erros.data}</Text>}
          {mostrarSeletorData && (
            <DateTimePicker
              value={parseDateInputToDate(data) ?? new Date()}
              mode="date"
              display="default"
              locale="pt-BR"
              maximumDate={new Date()}
              onChange={selecionarData}
            />
          )}

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
            {categorias.map(({ nome }) => (
              <TouchableOpacity key={nome} style={[styles.category, categoria === nome && styles.categoryActive]} onPress={() => setCategoria(nome)}>
                <Text style={[styles.categoryText, categoria === nome && styles.categoryTextActive]}>{nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {erroCategorias && <Text style={styles.erroCampo}>{erroCategorias}</Text>}

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
  inputComErro: { borderColor: "#D64545" },
  erroCampo: { color: "#D64545", fontSize: 12, marginTop: 5 },
  seletorData: { height: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 12, paddingHorizontal: 15, justifyContent: "center" },
  textoSeletorData: { color: "#0B3B33", fontSize: 14 },
  placeholderSeletorData: { color: "#8AA69E" },
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
