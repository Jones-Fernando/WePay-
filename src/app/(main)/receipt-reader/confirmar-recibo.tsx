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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { despesasPessoaisApi } from "@/services/api";

const CATEGORIAS = [
  { nome: "Alimentação", icone: "🍽️" },
  { nome: "Transporte", icone: "🚕" },
  { nome: "Casa", icone: "🏠" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Assinatura", icone: "🎬" },
  { nome: "Outros", icone: "📦" },
];

function converterValor(valor: string): number {
  const limpo = valor.replace(/R\$/gi, "").replace(/\s/g, "");

  if (limpo.includes(",") && limpo.includes(".")) {
    return Number(limpo.replace(/\./g, "").replace(",", "."));
  }

  return Number(limpo.replace(",", "."));
}

function converterDataParaIso(data: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;

  const brasileira = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brasileira) return null;

  const [, dia, mes, ano] = brasileira;
  const dataValidada = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const eValida =
    dataValidada.getFullYear() === Number(ano) &&
    dataValidada.getMonth() === Number(mes) - 1 &&
    dataValidada.getDate() === Number(dia);

  return eValida ? `${ano}-${mes}-${dia}` : null;
}

export default function ConfirmarRecibo() {
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
    const valorNumerico = converterValor(valorLimpo);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert("Atenção", "Digite um valor válido.");
      return;
    }
    if (!dataLimpa) {
      Alert.alert("Atenção", "Digite a data da despesa.");
      return;
    }

    const dataIso = converterDataParaIso(dataLimpa);
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
      <StatusBar barStyle="dark-content" />

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
              style={styles.input}
              placeholder="Ex.: Mercado"
              placeholderTextColor="#8AA69E"
              value={descricao}
              onChangeText={setDescricao}
              autoCapitalize="sentences"
            />
          </View>

          {/* VALOR */}
          <View style={styles.campo}>
            <Text style={styles.label}>Valor</Text>
            <View style={styles.valorContainer}>
              <Text style={styles.simbolo}>R$</Text>
              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor="#8AA69E"
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* DATA */}
          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: 10/09/2026"
              placeholderTextColor="#8AA69E"
              value={data}
              onChangeText={setData}
              keyboardType="numbers-and-punctuation"
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
              {CATEGORIAS.map((item) => {
                const selecionada = categoria === item.nome;
                return (
                  <TouchableOpacity
                    key={item.nome}
                    style={[styles.categoria, selecionada && styles.categoriaSelecionada]}
                    onPress={() => setCategoria(item.nome)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoriaIcone}>{item.icone}</Text>
                    <Text style={[styles.categoriaTexto, selecionada && styles.categoriaTextoSelecionado]}>
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  voltar: {
    fontSize: 32,
    color: "#0B3B33",
    marginTop: -3,
  },

  headerTexto: { flex: 1 },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3B33",
  },

  subtitulo: {
    fontSize: 12,
    color: "#6B8F86",
    marginTop: 4,
  },

  bannerIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F9F2",
    borderWidth: 1,
    borderColor: "#C9EFE1",
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
    color: "#0B3B33",
    lineHeight: 18,
    fontWeight: "600",
  },

  campo: { marginBottom: 20 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B3B33",
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 14,
    color: "#0B3B33",
  },

  valorContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 15,
  },

  simbolo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3B33",
    marginRight: 8,
  },

  inputValor: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    color: "#0B3B33",
  },

  categorias: { gap: 8, paddingRight: 10 },

  categoria: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  categoriaSelecionada: {
    backgroundColor: "#DDF7EE",
    borderColor: "#00C896",
  },

  categoriaIcone: { fontSize: 15, marginRight: 5 },

  categoriaTexto: {
    fontSize: 11,
    color: "#6B8F86",
    fontWeight: "600",
  },

  categoriaTextoSelecionado: { color: "#0B3B33" },

  botaoSalvar: {
    height: 54,
    backgroundColor: "#00C896",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  botaoDesabilitado: { opacity: 0.6 },

  botaoSalvarTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3B33",
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
    color: "#6B8F86",
  },
});
