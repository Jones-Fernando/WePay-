/*
 * WEPAY — DETALHES DA DESPESA PESSOAL
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "../../../constants/Cores";

export default function DetalhesDespesaPessoal() {
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const despesa = {
    id: id ?? "1",
    descricao: "Mercado",
    valor: 210,
    categoria: "Alimentação",
    data: "4 mai 2026",
  };

  function editar() {
    router.push({
      pathname: "/(main)/personal/editar-despesa-pessoal",
      params: {
        id: despesa.id,
      },
    });
  }

  function excluir() {
    Alert.alert(
      "Excluir despesa",
      "Deseja realmente excluir esta despesa?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
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
            Detalhes
          </Text>

          <TouchableOpacity onPress={editar}>
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.smallLabel}>
            DESPESA PESSOAL
          </Text>

          <Text style={styles.title}>
            {despesa.descricao}
          </Text>

          <Text style={styles.value}>
            R$ {despesa.valor.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        <View style={styles.details}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Categoria</Text>

            <Text style={styles.rowValue}>
              {despesa.categoria}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Data</Text>

            <Text style={styles.rowValue}>
              {despesa.data}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={excluir}
        >
          <Text style={styles.deleteText}>
            Excluir despesa
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
    paddingBottom: 35,
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

  editText: {
    color: Cores.principalEscuro,
    fontWeight: "700",
    fontSize: 13,
  },

  card: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 18,
    padding: 20,
    marginTop: 15,
  },

  smallLabel: {
    color: Cores.textoSuave,
    fontSize: 10,
    fontWeight: "700",
  },

  title: {
    color: Cores.texto,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 8,
  },

  value: {
    color: Cores.principalEscuro,
    fontSize: 25,
    fontWeight: "700",
    marginTop: 15,
  },

  details: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginTop: 14,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },

  rowLabel: {
    color: Cores.textoSuave,
    fontSize: 13,
  },

  rowValue: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "600",
  },

  deleteButton: {
    height: 52,
    borderWidth: 1,
    borderColor: Cores.negativo,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  deleteText: {
    color: Cores.negativo,
    fontWeight: "700",
  },
});
