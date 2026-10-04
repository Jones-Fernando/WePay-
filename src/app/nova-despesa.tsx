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

export default function NovaDespesaPessoal() {
  const params = useLocalSearchParams();
  const tipo = String(params.tipo ?? "pessoal");

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");

  const categorias = [
    { nome: "Alimentação", icone: "🍽️" },
    { nome: "Transporte", icone: "🚕" },
    { nome: "Casa", icone: "🏠" },
    { nome: "Lazer", icone: "🎮" },
    { nome: "Assinatura", icone: "🎬" },
    { nome: "Outros", icone: "📦" },
  ];

  function voltarParaTelaAnterior() {
    router.back();
  }

  function salvarDespesa() {
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

    const valorNumerico = Number(valorLimpo.replace(",", "."));

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert("Atenção", "Digite um valor válido.");
      return;
    }

    if (!dataLimpa) {
      Alert.alert("Atenção", "Digite a data da despesa.");
      return;
    }

    console.log("Nova despesa pessoal:", {
      descricao: descricaoLimpa,
      valor: valorNumerico,
      data: dataLimpa,
      categoria,
      tipo,
    });

    Alert.alert(
      "Despesa salva",
      "Sua despesa pessoal foi cadastrada com sucesso.",
      [
        {
          text: "OK",
          onPress: voltarParaTelaAnterior,
        },
      ]
    );
  }

  function lerRecibo() {
    router.push({
      pathname: "/ler-recibo",
      params: { tipo },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={voltarParaTelaAnterior}
              activeOpacity={0.8}
            >
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTexto}>
              <Text style={styles.titulo}>
                {tipo === "pessoal" ? "Nova despesa pessoal" : "Nova despesa"}
              </Text>

              <Text style={styles.subtitulo}>
                Fora dos grupos — só seu controle
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.cardIA}
            activeOpacity={0.85}
            onPress={lerRecibo}
          >
            <View style={styles.iconeIA}>
              <Text style={styles.iconeIAText}>📷</Text>
            </View>

            <View style={styles.iaTexto}>
              <Text style={styles.iaTitulo}>Ler recibo com foto</Text>
              <Text style={styles.iaSubtitulo}>
                Preencha os dados automaticamente com IA
              </Text>
            </View>

            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>

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
                    style={[
                      styles.categoria,
                      selecionada && styles.categoriaSelecionada,
                    ]}
                    onPress={() => setCategoria(item.nome)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoriaIcone}>{item.icone}</Text>
                    <Text
                      style={[
                        styles.categoriaTexto,
                        selecionada && styles.categoriaTextoSelecionado,
                      ]}
                    >
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.botaoSalvar}
            onPress={salvarDespesa}
            activeOpacity={0.85}
          >
            <Text style={styles.botaoSalvarTexto}>Salvar despesa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={voltarParaTelaAnterior}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>

          <View style={styles.espacoFinal} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },
  scroll: {
    flex: 1,
  },
  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 30,
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
  headerTexto: {
    flex: 1,
  },
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
  cardIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F9F2",
    borderWidth: 1,
    borderColor: "#C9EFE1",
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },
  iconeIA: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconeIAText: {
    fontSize: 21,
  },
  iaTexto: {
    flex: 1,
  },
  iaTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 3,
  },
  iaSubtitulo: {
    fontSize: 10,
    color: "#6B8F86",
    lineHeight: 15,
  },
  seta: {
    fontSize: 25,
    color: "#00A17A",
    marginLeft: 8,
  },
  campo: {
    marginBottom: 20,
  },
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
  categorias: {
    gap: 8,
    paddingRight: 10,
  },
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
  categoriaIcone: {
    fontSize: 15,
    marginRight: 5,
  },
  categoriaTexto: {
    fontSize: 11,
    color: "#6B8F86",
    fontWeight: "600",
  },
  categoriaTextoSelecionado: {
    color: "#0B3B33",
  },
  botaoSalvar: {
    height: 54,
    backgroundColor: "#00C896",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
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
  espacoFinal: {
    height: 20,
  },
});