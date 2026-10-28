import React, { useCallback, useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasGrupoApi } from "@/services/api";
import type { DespesaGrupo } from "@/types/api";

export default function EditarDespesaGrupo() {
  const params = useLocalSearchParams();
  const id = String(params.id ?? "");
  const groupId = String(params.groupId ?? "");
  const [despesaOriginal, setDespesaOriginal] = useState<DespesaGrupo | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [observacao, setObservacao] = useState(String(params.observacao ?? ""));

  const categorias = ["Alimentação", "Transporte", "Casa", "Lazer", "Assinatura", "Outros"];

  useFocusEffect(useCallback(() => {
    if (!Number.isInteger(Number(id))) return;
    let ativo = true;
    despesasGrupoApi.buscar(Number(id)).then(({ data: item }) => {
      if (!ativo) return;
      setDespesaOriginal(item);
      setDescricao(item.descricao);
      setValor(Number(item.valor).toFixed(2).replace(".", ","));
      setData(item.data_despesa.slice(8, 10) + "/" + item.data_despesa.slice(5, 7) + "/" + item.data_despesa.slice(0, 4));
      setCategoria(item.categoria || "Outros");
    }).catch((erro) => { if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar a despesa."); });
    return () => { ativo = false; };
  }, [id]));

  async function salvar() {
    const numero = Number(valor.trim().replace(/\./g, "").replace(",", "."));
    if (!descricao.trim() || !Number.isFinite(numero) || numero <= 0) {
      Alert.alert("Confira os dados", "Informe a descrição e um valor maior que zero.");
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      Alert.alert("Data inválida", "Utilize o formato DD/MM/AAAA.");
      return;
    }

    if (!despesaOriginal || salvando) return;
    try {
      setSalvando(true);
      await despesasGrupoApi.atualizar(Number(id), {
        descricao: descricao.trim(), valor: numero, categoria, pagador_id: despesaOriginal.pagador_id,
        data_despesa: data.slice(6, 10) + "-" + data.slice(3, 5) + "-" + data.slice(0, 2),
        participantes: (despesaOriginal.divisoes || []).map((item) => item.usuario_id),
        divisao_tipo: despesaOriginal.divisoes?.[0]?.tipo || "igual",
      });
      Alert.alert("Despesa atualizada", "As alterações foram salvas.", [{ text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/detalhes-despesa", params: { id, groupId } }) }]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível atualizar a despesa.");
    } finally { setSalvando(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Text style={styles.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Editar despesa</Text>
        <Text style={styles.subtitulo}>Atualize os dados da despesa compartilhada.</Text>

        <Text style={styles.label}>Descrição</Text>
        <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} placeholder="Descrição" />

        <Text style={styles.label}>Valor total (R$)</Text>
        <TextInput style={styles.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" />

        <Text style={styles.label}>Data</Text>
        <TextInput style={styles.input} value={data} onChangeText={setData} placeholder="DD/MM/AAAA" />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categorias}>
          {categorias.map((item) => (
            <TouchableOpacity key={item}
              onPress={() => setCategoria(item)}
              style={[styles.categoria, categoria === item && styles.categoriaAtiva]}>
              <Text style={[styles.categoriaTexto, categoria === item && styles.categoriaTextoAtivo]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput style={[styles.input, styles.observacao]} value={observacao}
          onChangeText={setObservacao} multiline placeholder="Informações adicionais" />

        <TouchableOpacity style={styles.salvar} onPress={salvar} disabled={salvando}>
          <Text style={styles.salvarTexto}>{salvando ? "Salvando..." : "Salvar alterações"}</Text>
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
  voltar: { marginBottom: 18 },
  voltarTexto: { color: "#0B3B33", fontSize: 14, fontWeight: "700" },
  titulo: { color: "#0B3B33", fontSize: 24, fontWeight: "800" },
  subtitulo: { color: "#6B8F86", fontSize: 12, lineHeight: 19, marginTop: 5, marginBottom: 25 },
  label: { color: "#0B3B33", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 13, paddingHorizontal: 14, fontSize: 14, color: "#0B3B33", marginBottom: 18 },
  categorias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  categoria: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 12 },
  categoriaAtiva: { backgroundColor: "#DDF7EE", borderColor: "#00C896" },
  categoriaTexto: { color: "#6B8F86", fontSize: 11, fontWeight: "600" },
  categoriaTextoAtivo: { color: "#0B3B33" },
  observacao: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  salvar: { minHeight: 52, backgroundColor: "#00C896", borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 5 },
  salvarTexto: { color: "#FFFFFF", fontWeight: "800" },
  cancelar: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cancelarTexto: { color: "#6B8F86", fontWeight: "700" },
});
