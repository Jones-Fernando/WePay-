import React, { useCallback, useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text,
  TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { saldosApi } from "@/services/api";
import { useUsuario } from "@/contexts/UsuarioContext";

export default function SaldosGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const { usuario } = useUsuario();
  const [saldos, setSaldos] = useState<{ id: string; devedorId: string; credorId: string; nome: string; direcao: string; valor: number }[]>([]);

  useFocusEffect(useCallback(() => {
    if (!Number.isInteger(Number(groupId)) || !usuario) return;
    let ativo = true;
    saldosApi.obter(Number(groupId)).then(({ data }) => {
      if (!ativo) return;
      const meuId = Number(usuario.id);
      setSaldos(data.dividas_simplificadas.filter((item) => item.devedor_id === meuId || item.credor_id === meuId).map((item, indice) => ({
        id: String(indice), devedorId: String(item.devedor_id), credorId: String(item.credor_id),
        nome: item.devedor_id === meuId ? item.credor : item.devedor,
        direcao: item.devedor_id === meuId ? "Você deve para" : "deve para você", valor: Number(item.valor),
      })));
    }).catch((erro) => { if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os saldos."); });
    return () => { ativo = false; };
  }, [groupId, usuario]));

  const aReceber = saldos
    .filter((s) => s.credorId === usuario?.id)
    .reduce((total, s) => total + s.valor, 0);

  const aPagar = saldos
    .filter((s) => s.devedorId === usuario?.id)
    .reduce((total, s) => total + s.valor, 0);

  function registrarPagamento(item: (typeof saldos)[number]) {
    router.push({
      pathname: "/(main)/group/registrar-pagamento",
      params: {
        groupId,
        grupoNome,
        participanteId: item.credorId,
        participanteNome: item.nome,
        valor: item.valor.toFixed(2).replace(".", ","),
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Saldos do grupo</Text>
        <Text style={styles.subtitulo}>{grupoNome}</Text>

        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.rotulo}>Você tem a receber</Text>
            <Text style={styles.positivo}>
              {aReceber.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </Text>
          </View>
          <View style={styles.separador} />
          <View style={styles.resumoItem}>
            <Text style={styles.rotulo}>Você tem a pagar</Text>
            <Text style={styles.negativo}>
              {aPagar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </Text>
          </View>
        </View>

        <Text style={styles.secao}>Pendências</Text>

        {saldos.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {item.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </Text>
            </View>

            <View style={styles.dados}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.direcao}>{item.direcao}</Text>
              <Text style={styles.valor}>
                {item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </Text>
            </View>

            {item.devedorId === usuario?.id ? <TouchableOpacity style={styles.botaoPagar}
              onPress={() => registrarPagamento(item)}>
              <Text style={styles.botaoPagarTexto}>Registrar</Text>
            </TouchableOpacity> : null}
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { color: "#0B3B33", fontSize: 14, fontWeight: "700", marginBottom: 20 },
  titulo: { color: "#0B3B33", fontSize: 24, fontWeight: "800" },
  subtitulo: { color: "#6B8F86", fontSize: 12, marginTop: 5 },
  resumo: { backgroundColor: "#0B3B33", borderRadius: 18, padding: 17, marginTop: 22, marginBottom: 26 },
  resumoItem: { paddingVertical: 8 },
  rotulo: { color: "#BFE0D6", fontSize: 11 },
  positivo: { color: "#79E5BB", fontSize: 23, fontWeight: "800", marginTop: 5 },
  negativo: { color: "#FFAD9F", fontSize: 23, fontWeight: "800", marginTop: 5 },
  separador: { height: 1, backgroundColor: "#426E63", marginVertical: 8 },
  secao: { color: "#0B3B33", fontSize: 17, fontWeight: "800", marginBottom: 13 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E1EEE8", padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#DDF7EE", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarTexto: { color: "#087F5B", fontSize: 11, fontWeight: "800" },
  dados: { flex: 1 },
  nome: { color: "#0B3B33", fontSize: 12, fontWeight: "800" },
  direcao: { color: "#6B8F86", fontSize: 10, marginTop: 4 },
  valor: { color: "#0B3B33", fontSize: 13, fontWeight: "800", marginTop: 5 },
  botaoPagar: { backgroundColor: "#DDF7EE", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, marginLeft: 6 },
  botaoPagarTexto: { color: "#087F5B", fontSize: 10, fontWeight: "800" },
  aviso: { color: "#6B8F86", fontSize: 10, lineHeight: 16, marginTop: 15, textAlign: "center" },
});
