import React, { useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { pagamentosApi } from "@/services/api";

export default function RegistrarPagamento() {
  const params = useLocalSearchParams();

  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const participanteNome = String(params.participanteNome ?? "Participante");
  const valorInicial = String(params.valor ?? "");

  const [valor, setValor] = useState(valorInicial);
  const [data, setData] = useState("25/10/2026");
  const [metodo, setMetodo] = useState("PIX");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarPagamento() {
    const numero = Number(valor.trim().replace(/\./g, "").replace(",", "."));

    if (!groupId) {
      Alert.alert("Grupo não identificado", "Retorne ao grupo e abra novamente o registro de pagamento.");
      return;
    }

    if (!Number.isFinite(numero) || numero <= 0) {
      Alert.alert("Valor inválido", "Informe um valor maior que zero.");
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      Alert.alert("Data inválida", "Utilize o formato DD/MM/AAAA.");
      return;
    }

    const participanteId = Number(params.participanteId);
    if (!Number.isInteger(participanteId) || salvando) return;
    try {
      setSalvando(true);
      await pagamentosApi.criar({
        grupo_id: Number(groupId), recebedor_id: participanteId, valor: numero,
        data_pagamento: data.slice(6, 10) + "-" + data.slice(3, 5) + "-" + data.slice(0, 2),
        metodo, observacao: observacao.trim() || undefined,
      });
      Alert.alert("Pagamento registrado", "Os saldos foram recalculados.", [{ text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/saldos", params: { groupId, grupoNome } }) }]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível registrar o pagamento.");
    } finally { setSalvando(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Registrar pagamento</Text>
        <Text style={styles.subtitulo}>{grupoNome}</Text>

        <View style={styles.cardPessoa}>
          <Text style={styles.rotulo}>Pagamento relacionado a</Text>
          <Text style={styles.nome}>{participanteNome}</Text>
          <Text style={styles.ajuda}>
            Confirme o valor e a data antes de registrar.
          </Text>
        </View>

        <Text style={styles.label}>Valor pago (R$)</Text>
        <TextInput style={styles.input} value={valor}
          onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" />

        <Text style={styles.label}>Data do pagamento</Text>
        <TextInput style={styles.input} value={data}
          onChangeText={setData} placeholder="DD/MM/AAAA" />

        <Text style={styles.label}>Método de pagamento</Text>
        <View style={styles.metodos}>
          {["PIX", "DINHEIRO", "TRANSFERÊNCIA", "OUTRO"].map((item) => (
            <TouchableOpacity key={item}
              onPress={() => setMetodo(item)}
              style={[styles.metodo, metodo === item && styles.metodoAtivo]}>
              <Text style={[styles.metodoTexto, metodo === item && styles.metodoTextoAtivo]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput style={[styles.input, styles.observacao]}
          value={observacao} onChangeText={setObservacao}
          placeholder="Ex.: Pagamento via Pix" multiline />

        <TouchableOpacity style={styles.salvar} onPress={salvarPagamento} disabled={salvando}>
          <Text style={styles.salvarTexto}>{salvando ? "Registrando..." : "Confirmar pagamento"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelar} onPress={() => router.back()}>
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { color: "#0B3B33", fontSize: 14, fontWeight: "700", marginBottom: 20 },
  titulo: { color: "#0B3B33", fontSize: 24, fontWeight: "800" },
  subtitulo: { color: "#6B8F86", fontSize: 12, marginTop: 5, marginBottom: 23 },
  cardPessoa: { backgroundColor: "#E8F9F2", borderWidth: 1, borderColor: "#C9EFE1", borderRadius: 15, padding: 16, marginBottom: 22 },
  rotulo: { color: "#6B8F86", fontSize: 11 },
  nome: { color: "#0B3B33", fontSize: 16, fontWeight: "800", marginTop: 6 },
  ajuda: { color: "#6B8F86", fontSize: 11, marginTop: 5, lineHeight: 17 },
  label: { color: "#0B3B33", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 13, paddingHorizontal: 14, fontSize: 14, color: "#0B3B33", marginBottom: 18 },
  metodos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  metodo: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  metodoAtivo: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  metodoTexto: { color: "#6B8F86", fontSize: 10, fontWeight: "700" },
  metodoTextoAtivo: { color: "#0B3B33" },
  observacao: { minHeight: 85, paddingTop: 12, textAlignVertical: "top" },
  salvar: { minHeight: 52, backgroundColor: "#00C896", borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 5 },
  salvarTexto: { color: "#FFFFFF", fontWeight: "800" },
  cancelar: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 7 },
  cancelarTexto: { color: "#6B8F86", fontWeight: "700" },
});
