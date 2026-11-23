import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { pagamentosApi } from "@/services/api";
import { parseCurrencyInput, parseDateInputToIso } from "@/utils/financeInput";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

export default function RegistrarPagamento() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();

  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const participanteNome = String(params.participanteNome ?? "Participante");
  const valorInicial = String(params.valor ?? "");

  const [valor, setValor] = useState(valorInicial);
  const [data, setData] = useState(() => {
    const hoje = new Date();
    return `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  });
  const [metodo, setMetodo] = useState("PIX");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();
  const pagamentoPendenteRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);

  const valorNumerico = parseCurrencyInput(valor);
  const dataIso = parseDateInputToIso(data.trim());
  const erroValor = !valor.trim()
    ? "Informe um valor maior que zero."
    : !Number.isFinite(valorNumerico) || valorNumerico <= 0
      ? "Informe um valor maior que zero."
      : "";
  const erroData = !data.trim()
    ? "Informe a data do pagamento."
    : !dataIso
      ? "Use o formato DD/MM/AAAA válido."
      : "";

  async function salvarPagamento() {
    if (!groupId) {
      Alert.alert("Grupo não identificado", "Retorne ao grupo e abra novamente o registro de pagamento.");
      return;
    }

    if (erroValor) {
      Alert.alert("Valor inválido", erroValor);
      return;
    }

    if (erroData) {
      Alert.alert("Data inválida", erroData);
      return;
    }

    const participanteId = Number(params.participanteId);
    if (!Number.isInteger(participanteId) || salvando) return;
    const dadosPagamento = {
      grupo_id: Number(groupId),
      recebedor_id: participanteId,
      valor: valorNumerico,
      data_pagamento: dataIso!,
      metodo,
      observacao: observacao.trim() || undefined,
    };
    const fingerprint = JSON.stringify(dadosPagamento);
    if (pagamentoPendenteRef.current?.fingerprint !== fingerprint) {
      pagamentoPendenteRef.current = {
        fingerprint,
        idempotencyKey: Crypto.randomUUID(),
      };
    }

    try {
      setSalvando(true);
      await pagamentosApi.criar(
        dadosPagamento,
        pagamentoPendenteRef.current.idempotencyKey,
      );
      Alert.alert("Pagamento registrado", "Os saldos foram recalculados.", [{ text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/saldos", params: { groupId, grupoNome } }) }]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível registrar o pagamento.");
    } finally { setSalvando(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
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
        <TextInput
          style={[
            styles.input,
            erroValor ? styles.inputErro : null,
            !erroValor && focusedField === "valor" && styles.focusedField,
          ]}
          value={valor}
          onChangeText={setValor}
          {...focusHandlers("valor")}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        {erroValor ? <Text style={styles.erroTexto}>{erroValor}</Text> : null}

        <Text style={styles.label}>Data do pagamento</Text>
        <TextInput
          style={[
            styles.input,
            erroData ? styles.inputErro : null,
            !erroData && focusedField === "data" && styles.focusedField,
          ]}
          value={data}
          onChangeText={setData}
          {...focusHandlers("data")}
          placeholder="DD/MM/AAAA"
        />
        {erroData ? <Text style={styles.erroTexto}>{erroData}</Text> : null}

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
        <TextInput style={[
          styles.input,
          styles.observacao,
          focusedField === "observacao" && styles.focusedField,
        ]}
          value={observacao} onChangeText={setObservacao}
          placeholder="Ex.: Pagamento via Pix" multiline
          {...focusHandlers("observacao")} />

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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { color: Cores.texto, fontSize: 14, fontWeight: "700", marginBottom: 20 },
  titulo: { color: Cores.texto, fontSize: 24, fontWeight: "800" },
  subtitulo: { color: Cores.textoSuave, fontSize: 12, marginTop: 5, marginBottom: 23 },
  cardPessoa: { backgroundColor: Cores.superficieVerde, borderWidth: 1, borderColor: Cores.bordaDestaque, borderRadius: 15, padding: 16, marginBottom: 22 },
  rotulo: { color: Cores.textoSuave, fontSize: 11 },
  nome: { color: Cores.texto, fontSize: 16, fontWeight: "800", marginTop: 6 },
  ajuda: { color: Cores.textoSuave, fontSize: 11, marginTop: 5, lineHeight: 17 },
  label: { color: Cores.texto, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: Cores.texto, marginBottom: 18, outlineStyle: "solid", outlineWidth: 0 },
  inputErro: { borderColor: Cores.negativo },
  focusedField: { borderWidth: 2, borderColor: Cores.textoPositivo },
  erroTexto: { color: Cores.textoNegativo, fontSize: 11, lineHeight: 16, marginTop: -10, marginBottom: 12 },
  metodos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  metodo: { backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  metodoAtivo: { backgroundColor: Cores.superficieVerdeSelecionada, borderColor: Cores.principal },
  metodoTexto: { color: Cores.textoSuave, fontSize: 10, fontWeight: "700" },
  metodoTextoAtivo: { color: Cores.texto },
  observacao: { minHeight: 85, paddingTop: 12, textAlignVertical: "top" },
  salvar: { minHeight: 52, backgroundColor: Cores.principal, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 5 },
  salvarTexto: { color: Cores.textoSobreAcao, fontWeight: "800" },
  cancelar: { minHeight: 45, alignItems: "center", justifyContent: "center", marginTop: 7 },
  cancelarTexto: { color: Cores.textoSuave, fontWeight: "700" },
});
