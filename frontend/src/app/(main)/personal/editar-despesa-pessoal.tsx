import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert } from "@/services/feedback";
import { Feather } from "@expo/vector-icons";
import CalendarioData from "@/components/CalendarioData";
import { despesasPessoaisApi } from "@/services/api";
import { CATEGORIAS_PESSOAIS } from "@/constants/financeCategories";
import { useFieldFocus } from "@/hooks/useFieldFocus";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { IconeCategoria } from "@/components/IconeCategoria";
import {
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToIso,
} from "@/utils/financeInput";

type CampoFormulario = "descricao" | "valor" | "data";

export default function EditarDespesaPessoal() {
  const Cores = useAppTheme();
  const esquema = useAppThemeScheme();
  const styles = createStyles(Cores);
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
  const { focusedField, focusHandlers } = useFieldFocus();
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

  function selecionarData(dataSelecionada: string) {
    setMostrarSeletorData(false);
    setData(dataSelecionada);
    setCamposVisitados((atuais) => ({ ...atuais, data: true }));
    setErros((atuais) => ({ ...atuais, data: validarCampo("data", dataSelecionada) }));
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

  if (carregando) return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <ActivityIndicator color={Cores.principal} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Feather name="arrow-left" size={20} color={Cores.texto} accessible={false} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Editar despesa pessoal</Text>
              <Text style={styles.headerSubtitle}>Atualize os dados da sua movimentação.</Text>
            </View>
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[
                styles.input,
                erros.descricao && styles.inputComErro,
                !erros.descricao && focusedField === "descricao" && styles.focusedField,
              ]}
              placeholder="Ex.: Mercado"
              placeholderTextColor={Cores.placeholder}
              value={descricao}
              onChangeText={(texto) => atualizarCampo("descricao", texto)}
              {...focusHandlers("descricao", () => visitarCampo("descricao", descricao))}
              autoCapitalize="sentences"
              accessibilityLabel="Descrição"
            />
            {erros.descricao && <Text style={styles.erroCampo}>{erros.descricao}</Text>}
          </View>

          <View style={styles.valorCampo}>
            <Text style={styles.valorLabel}>Valor</Text>
            <View style={[
              styles.valueContainer,
              erros.valor && styles.inputComErro,
              focusedField === "valor" && styles.focusedValueContainer,
            ]}>
              <Text style={styles.currency}>R$</Text>
              <TextInput
                style={styles.valueInput}
                value={valor}
                placeholder="0,00"
                placeholderTextColor={Cores.placeholder}
                onChangeText={(texto) => atualizarCampo("valor", texto)}
                {...focusHandlers("valor", () => visitarCampo("valor", valor))}
                keyboardType="decimal-pad"
                accessibilityLabel="Valor da movimentação"
              />
            </View>
            {erros.valor && <Text style={styles.erroCampo}>{erros.valor}</Text>}
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              testID="date-selector"
              style={[styles.seletorData, erros.data && styles.inputComErro]}
              onPress={() => setMostrarSeletorData(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Data ${data}. Abrir calendário`}
            >
              <Text
                style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {data || "Escolher data"}
              </Text>
              <Feather name="calendar" size={16} color={Cores.textoSuave} accessible={false} />
            </TouchableOpacity>
            {erros.data && <Text style={styles.erroCampo}>{erros.data}</Text>}
            {mostrarSeletorData && (
              <CalendarioData
                value={data}
                onClose={() => setMostrarSeletorData(false)}
                onSelectDate={selecionarData}
              />
            )}
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView
              horizontal
              style={styles.categoryScroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 10 }}
            >
              {categorias.map((item) => (
                <TouchableOpacity
                  key={item.nome}
                  style={[styles.category, categoria === item.nome && styles.categoryActive]}
                  onPress={() => setCategoria(item.nome)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: categoria === item.nome }}
                >
                  <IconeCategoria icone={item.icone} tamanho={15} style={{ marginRight: 5 }} />
                  <Text style={[styles.categoryText, categoria === item.nome && styles.categoryTextActive]}>{item.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {erroCategorias && <Text style={styles.erroCampo}>{erroCategorias}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, salvando && { opacity: 0.6 }]}
            onPress={salvar}
            disabled={salvando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: salvando, busy: salvando }}
          >
            {salvando ? <ActivityIndicator color={Cores.textoSobrePrincipal} /> : <Text style={styles.saveButtonText}>Salvar alterações</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, justifyContent: "center", alignItems: "center", marginRight: 12 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: Cores.texto, fontWeight: "700", fontSize: 20, flexShrink: 1 },
  headerSubtitle: { color: Cores.textoSuave, fontSize: 12, marginTop: 4 },
  valorCampo: { marginBottom: 20 },
  valorLabel: { color: Cores.texto, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  campo: { marginBottom: 20 },
  label: { color: Cores.texto, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 15, color: Cores.texto, fontSize: 14, outlineStyle: "solid", outlineWidth: 0 },
  inputComErro: { borderColor: Cores.negativo },
  focusedField: { borderWidth: 2, borderColor: Cores.textoPositivo },
  erroCampo: { color: Cores.textoNegativo, fontSize: 12, marginTop: 5 },
  seletorData: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textoSeletorData: { color: Cores.texto, fontSize: 14, flex: 1, minWidth: 0, marginRight: 12 },
  placeholderSeletorData: { color: Cores.placeholder },
  valueContainer: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 15 },
  focusedValueContainer: { borderWidth: 2, borderColor: Cores.textoPositivo },
  currency: { color: Cores.texto, fontSize: 14, marginRight: 10 },
  valueInput: { flex: 1, height: "100%", color: Cores.texto, fontSize: 14, outlineStyle: "solid", outlineWidth: 0 },
  category: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda },
  categoryScroll: { width: "100%", flexGrow: 0, flexShrink: 1 },
  categoryActive: { backgroundColor: Cores.superficieVerdeSelecionada, borderColor: Cores.principal },
  categoryText: { color: Cores.textoSuave, fontSize: 11, fontWeight: "600" },
  categoryTextActive: { color: Cores.textoPositivo },
  saveButton: { height: 54, backgroundColor: Cores.principal, borderRadius: 15, justifyContent: "center", alignItems: "center", marginTop: 4 },
  saveButtonText: { color: Cores.textoSobrePrincipal, fontWeight: "700", fontSize: 15 },
  cancelButton: { height: 48, justifyContent: "center", alignItems: "center", marginTop: 5 },
  cancelButtonText: { color: Cores.textoSuave, fontWeight: "600", fontSize: 13 },
});
