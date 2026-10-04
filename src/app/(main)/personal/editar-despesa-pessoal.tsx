/*
 * WEPAY — EDITAR DESPESA PESSOAL
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "../../../constants/Cores";

export default function EditarDespesaPessoal() {
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [descricao, setDescricao] =
    useState("Mercado");

  const [valor, setValor] =
    useState("210,00");

  const [data, setData] =
    useState("04/05/2026");

  const [categoria, setCategoria] =
    useState("Alimentação");

  function salvar() {
    const valorNumerico =
      Number(valor.replace(",", ".")) || 0;

    if (!descricao.trim()) {
      Alert.alert(
        "Atenção",
        "Informe a descrição."
      );
      return;
    }

    if (valorNumerico <= 0) {
      Alert.alert(
        "Atenção",
        "Informe um valor válido."
      );
      return;
    }

    console.log("Despesa pessoal editada:", {
      id,
      descricao: descricao.trim(),
      valor: valorNumerico,
      data,
      categoria,
    });

    Alert.alert(
      "Despesa atualizada",
      "As alterações foram salvas.",
      [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Editar despesa
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.label}>Descrição</Text>

        <TextInput
          style={styles.input}
          value={descricao}
          onChangeText={setDescricao}
        />

        <Text style={styles.label}>Valor</Text>

        <View style={styles.valueContainer}>
          <Text style={styles.currency}>R$</Text>

          <TextInput
            style={styles.valueInput}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>Data</Text>

        <TextInput
          style={styles.input}
          value={data}
          onChangeText={setData}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={Cores.textoSuave}
        />

        <Text style={styles.label}>Categoria</Text>

        <View style={styles.categories}>
          {[
            "Alimentação",
            "Transporte",
            "Casa",
            "Lazer",
            "Assinatura",
            "Outros",
          ].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.category,
                categoria === item &&
                  styles.categoryActive,
              ]}
              onPress={() => setCategoria(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  categoria === item &&
                    styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={salvar}
        >
          <Text style={styles.saveButtonText}>
            Salvar alterações
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    height: 65,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    color: Cores.texto,
    fontSize: 32,
  },

  headerTitle: {
    color: Cores.texto,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
  },

  valueContainer: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  currency: {
    color: Cores.texto,
    fontWeight: "700",
    marginRight: 8,
  },

  valueInput: {
    flex: 1,
    color: Cores.texto,
  },

  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  category: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  categoryActive: {
    backgroundColor: Cores.texto,
    borderColor: Cores.texto,
  },

  categoryText: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "600",
  },

  categoryTextActive: {
    color: Cores.branco,
  },

  saveButton: {
    height: 52,
    backgroundColor: Cores.principal,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  saveButtonText: {
    color: Cores.texto,
    fontWeight: "700",
  },
});