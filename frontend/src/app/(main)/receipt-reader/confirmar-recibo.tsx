import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/*
 * WEPAY — CONFIRMAR RECIBO
 * Exibe os dados extraídos pela IA e permite ao usuário
 * editar e salvar como despesa pessoal.
 */
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import { Alert } from "@/services/feedback";
import { despesasPessoaisApi } from "@/services/api";
import {
  parseCurrencyInput,
  parseDateInputToIso,
} from "@/utils/financeInput";
import { CATEGORIAS_RECIBO as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function ConfirmarRecibo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("pessoal", CATEGORIAS);
  const params = useLocalSearchParams<{
    descricao: string;
    valor: string;
    data: string;
    categoria: string;
    origem?: string;
    modo?: string;
    groupId?: string;
    grupoNome?: string;
    despesaId?: string;
  }>();

  const [descricao, setDescricao] = useState(params.descricao ?? "");
  const [valor, setValor] = useState(params.valor ?? "");
  const [data, setData] = useState(params.data ?? "");
  const [categoria, setCategoria] = useState(params.categoria ?? "Alimentação");
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

  async function salvarDespesa() {
    const descricaoLimpa = descricao.trim();
    const valorLimpo = valor.trim();
    const dataLimpa = data.trim();

    if (!descricaoLimpa) {
      Alert.alert("Atenção", "Digite a descrição da despesa.");
      return;
    }
    if (!valorLimpo) {
      Alert.alert("Atenção", "Digite o valor da despesa.");
      return;
    }
    const valorNumerico = parseCurrencyInput(valorLimpo);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert("Atenção", "Digite um valor válido.");
      return;
    }
    if (!dataLimpa) {
      Alert.alert("Atenção", "Digite a data da despesa.");
      return;
    }

    const dataIso = parseDateInputToIso(dataLimpa);
    if (!dataIso) {
      Alert.alert("Atenção", "Digite uma data válida no formato DD/MM/AAAA ou AAAA-MM-DD.");
      return;
    }

    // A confirmação apenas revisa a extração. Para uma despesa de grupo,
    // devolvemos os campos ao formulário, que ainda precisa definir pagador e
    // divisão antes de persistir.
    if (params.origem === "grupo") {
      if (!params.groupId) {
        Alert.alert("Grupo não identificado", "Volte e selecione um grupo antes de continuar.");
        return;
      }
      router.replace({
        pathname: "/(main)/group/nova-despesa",
        params: {
          groupId: params.groupId,
          grupoNome: params.grupoNome ?? "",
          descricao: descricaoLimpa,
          valor: valorNumerico.toFixed(2).replace(".", ","),
          data: dataIso,
          categoria,
        },
      });
      return;
    }

    setSalvando(true);
    try {
      await despesasPessoaisApi.criar({
        descricao: descricaoLimpa,
        valor: valorNumerico,
        categoria,
        tipo: "despesa",
        data_despesa: dataIso,
      });

      Alert.alert("Despesa salva", "Sua despesa foi cadastrada com sucesso.", [
        { text: "OK", onPress: () => router.replace("/(main)/personal/despesas-pessoais") },
      ]);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a despesa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* CABEÇALHO */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTexto}>
              <Text style={styles.titulo}>Confirmar despesa</Text>
              <Text style={styles.subtitulo}>Revise os dados extraídos pela IA</Text>
            </View>
          </View>

          {/* BANNER IA */}
          <View style={styles.bannerIA}>
            <Text style={styles.bannerIcone}>✨</Text>
            <Text style={styles.bannerTexto}>
              Dados preenchidos automaticamente. Verifique antes de salvar.
            </Text>
          </View>

          {/* DESCRIÇÃO */}
          <View style={styles.campo}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "descricao" && styles.focusedField,
              ]}
              placeholder="Ex.: Mercado"
              placeholderTextColor={Cores.placeholder}
              value={descricao}
              onChangeText={setDescricao}
              autoCapitalize="sentences"
              {...focusHandlers("descricao")}
            />
          </View>

          {/* VALOR */}
          <View style={styles.campo}>
            <Text style={styles.label}>Valor</Text>
            <View style={[
              styles.valorContainer,
              focusedField === "valor" && styles.valorContainerFocado,
            ]}>
              <Text style={styles.simbolo}>R$</Text>
              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor={Cores.placeholder}
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                {...focusHandlers("valor")}
              />
            </View>
          </View>

          {/* DATA */}
          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "data" && styles.focusedField,
              ]}
              placeholder="Ex.: 10/09/2026"
              placeholderTextColor={Cores.placeholder}
              value={data}
              onChangeText={setData}
              keyboardType="numbers-and-punctuation"
              {...focusHandlers("data")}
            />
          </View>

          {/* CATEGORIA */}
          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categorias}
            >
              {categorias.map((item) => {
                const selecionada = categoria === item.nome;
                return (
                  <TouchableOpacity
                    key={item.nome}
                    style={[styles.categoria, selecionada && styles.categoriaSelecionada]}
                    onPress={() => setCategoria(item.nome)}
                    activeOpacity={0.8}
                  >
                    <IconeCategoria icone={item.icone} tamanho={15} style={{ marginRight: 5 }} />
                    <Text style={[styles.categoriaTexto, selecionada && styles.categoriaTextoSelecionado]}>
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {erroCategorias && <Text style={styles.erroCategorias}>{erroCategorias}</Text>}
          </View>

          {/* BOTÕES */}
          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
            onPress={salvarDespesa}
            disabled={salvando}
            activeOpacity={0.85}
          >
            <Text style={styles.botaoSalvarTexto}>
              {salvando ? "Salvando..." : params.origem === "grupo" ? "Continuar despesa em grupo" : "Salvar despesa"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 22,
  },

  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  voltar: {
    fontSize: 32,
    color: Cores.texto,
    marginTop: -3,
  },

  headerTexto: { flex: 1 },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: Cores.texto,
  },

  subtitulo: {
    fontSize: 12,
    color: Cores.textoSuave,
    marginTop: 4,
  },

  bannerIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.superficieVerde,
    borderWidth: 1,
    borderColor: Cores.bordaDestaque,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },

  bannerIcone: {
    fontSize: 20,
  },

  bannerTexto: {
    flex: 1,
    fontSize: 12,
    color: Cores.texto,
    lineHeight: 18,
    fontWeight: "600",
  },

  campo: { marginBottom: 20 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.texto,
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 14,
    color: Cores.texto,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },

  valorContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  valorContainerFocado: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },

  simbolo: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.texto,
    marginRight: 8,
  },

  inputValor: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    color: Cores.texto,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  categorias: { gap: 8, paddingRight: 10 },
  erroCategorias: { color: Cores.textoNegativo, fontSize: 12, marginTop: 6 },

  categoria: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  categoriaSelecionada: {
    backgroundColor: Cores.superficieVerdeSelecionada,
    borderColor: Cores.principal,
  },


  categoriaTexto: {
    fontSize: 11,
    color: Cores.textoSuave,
    fontWeight: "600",
  },

  categoriaTextoSelecionado: { color: Cores.texto },

  botaoSalvar: {
    height: 54,
    backgroundColor: Cores.principal,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  botaoDesabilitado: { opacity: 0.6 },

  botaoSalvarTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: Cores.textoSobrePrincipal,
  },

  botaoCancelar: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  botaoCancelarTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.textoSuave,
  },
});
