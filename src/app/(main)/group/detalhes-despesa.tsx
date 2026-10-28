import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasGrupoApi } from "@/services/api";
import type { DespesaGrupo } from "@/types/api";

const moeda = (valor: number | string) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataFormatada = (data: string) =>
  new Date(`${data.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");

const nomesDivisao = {
  igual: "Divisão igual",
  porcentagem: "Por porcentagem",
  valores: "Valores definidos",
} as const;

export default function DetalhesDespesa() {
  const { id, groupId, grupoNome } = useLocalSearchParams<{
    id?: string;
    groupId?: string;
    grupoNome?: string;
  }>();
  const [despesa, setDespesa] = useState<DespesaGrupo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  const voltarParaLista = useCallback(() => {
    router.replace({
      pathname: "/(main)/group/despesas-grupo",
      params: { groupId, grupoNome },
    });
  }, [groupId, grupoNome]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !Number.isInteger(Number(id))) {
        setCarregando(false);
        return;
      }

      let ativo = true;
      setCarregando(true);
      despesasGrupoApi
        .buscar(Number(id))
        .then(({ data }) => {
          if (ativo) setDespesa(data);
        })
        .catch((erro) => {
          if (ativo) {
            Alert.alert(
              "Erro",
              erro instanceof Error ? erro.message : "Não foi possível carregar a despesa."
            );
          }
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      return () => {
        ativo = false;
      };
    }, [id])
  );

  function editar() {
    if (!despesa) return;
    router.push({
      pathname: "/(main)/group/editar-despesa",
      params: { id: String(despesa.id), groupId, grupoNome },
    });
  }

  function confirmarExclusao() {
    if (!despesa || excluindo) return;
    Alert.alert("Excluir despesa", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setExcluindo(true);
            await despesasGrupoApi.deletar(despesa.id);
            voltarParaLista();
          } catch (erro) {
            Alert.alert(
              "Erro",
              erro instanceof Error ? erro.message : "Não foi possível excluir a despesa."
            );
          } finally {
            setExcluindo(false);
          }
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.centralizado}>
        <ActivityIndicator color="#00A17A" size="large" />
        <Text style={styles.textoAjuda}>Carregando despesa...</Text>
      </SafeAreaView>
    );
  }

  if (!despesa) {
    return (
      <SafeAreaView style={styles.centralizado}>
        <Text style={styles.tituloVazio}>Despesa não encontrada</Text>
        <TouchableOpacity style={styles.botaoPrincipal} onPress={voltarParaLista}>
          <Text style={styles.botaoPrincipalTexto}>Voltar para despesas</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const divisoes = despesa.divisoes ?? [];
  const tipoDivisao = divisoes[0]?.tipo ?? "igual";
  const valorTotal = Number(despesa.valor);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.cabecalho}>
          <TouchableOpacity onPress={voltarParaLista} style={styles.botaoVoltar}>
            <Text style={styles.voltar}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Detalhes da despesa</Text>
          <View style={styles.espacador} />
        </View>

        <View style={styles.resumo}>
          <Text style={styles.descricao}>{despesa.descricao}</Text>
          <Text style={styles.valor}>{moeda(valorTotal)}</Text>
          <Text style={styles.categoria}>{despesa.categoria || "Sem categoria"}</Text>
          <Text style={styles.textoAjuda}>{dataFormatada(despesa.data_despesa)}</Text>
        </View>

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>Pago por</Text>
          <Text style={styles.destaque}>{despesa.pagador_nome || "Participante"}</Text>
          <View style={styles.linha} />
          <Text style={styles.rotulo}>Divisão</Text>
          <Text style={styles.destaque}>{nomesDivisao[tipoDivisao]}</Text>
        </View>

        <Text style={styles.subtitulo}>Participantes ({divisoes.length})</Text>
        <View style={styles.cartao}>
          {divisoes.map((divisao, indice) => {
            const valorDivisao =
              divisao.tipo === "porcentagem"
                ? (valorTotal * Number(divisao.percentual ?? 0)) / 100
                : Number(divisao.valor ?? (divisoes.length ? valorTotal / divisoes.length : 0));
            return (
              <View key={divisao.usuario_id}>
                <View style={styles.participante}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>{(divisao.nome || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.participanteInfo}>
                    <Text style={styles.destaque}>{divisao.nome || "Participante"}</Text>
                    <Text style={styles.textoAjuda}>
                      {divisao.tipo === "porcentagem"
                        ? `${Number(divisao.percentual ?? 0)}%`
                        : nomesDivisao[divisao.tipo]}
                    </Text>
                  </View>
                  <Text style={styles.valorParticipante}>{moeda(valorDivisao)}</Text>
                </View>
                {indice < divisoes.length - 1 && <View style={styles.linha} />}
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.botaoPrincipal} onPress={editar}>
          <Text style={styles.botaoPrincipalTexto}>Editar despesa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.botaoExcluir}
          onPress={confirmarExclusao}
          disabled={excluindo}
        >
          <Text style={styles.botaoExcluirTexto}>{excluindo ? "Excluindo..." : "Excluir despesa"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  centralizado: { flex: 1, backgroundColor: "#F5FBF7", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  conteudo: { padding: 20, paddingBottom: 40 },
  cabecalho: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  voltar: { fontSize: 34, lineHeight: 36, color: "#0B3B33" },
  titulo: { flex: 1, textAlign: "center", color: "#0B3B33", fontSize: 18, fontWeight: "700" },
  espacador: { width: 42 },
  resumo: { alignItems: "center", backgroundColor: "#FFF", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: "#E1EEE8" },
  descricao: { color: "#0B3B33", fontSize: 24, fontWeight: "700", textAlign: "center" },
  valor: { color: "#0B3B33", fontSize: 30, fontWeight: "800", marginVertical: 10 },
  categoria: { color: "#00A17A", backgroundColor: "#E9F9F3", overflow: "hidden", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, fontWeight: "700" },
  cartao: { marginTop: 18, backgroundColor: "#FFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E1EEE8" },
  rotulo: { color: "#6B8F86", fontSize: 12, marginBottom: 4 },
  destaque: { color: "#0B3B33", fontSize: 16, fontWeight: "700" },
  linha: { height: 1, backgroundColor: "#E1EEE8", marginVertical: 14 },
  subtitulo: { color: "#0B3B33", fontSize: 18, fontWeight: "700", marginTop: 26 },
  participante: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DDF6ED", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarTexto: { color: "#0B3B33", fontWeight: "800" },
  participanteInfo: { flex: 1 },
  valorParticipante: { color: "#00A17A", fontSize: 15, fontWeight: "800" },
  textoAjuda: { color: "#6B8F86", fontSize: 13 },
  tituloVazio: { color: "#0B3B33", fontWeight: "700", fontSize: 18 },
  botaoPrincipal: { marginTop: 26, minHeight: 52, backgroundColor: "#00A17A", borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  botaoPrincipalTexto: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  botaoExcluir: { marginTop: 10, minHeight: 52, borderWidth: 1, borderColor: "#E85D5D", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  botaoExcluirTexto: { color: "#E85D5D", fontWeight: "700", fontSize: 15 },
});
