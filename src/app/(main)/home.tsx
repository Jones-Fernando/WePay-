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
import { Redirect, router, useFocusEffect } from "expo-router";
import { dashboardApi, despesasPessoaisApi, gruposApi } from "@/services/api";
import type { Dashboard, DespesaPessoal, Grupo } from "@/types/api";
import { useUsuario } from "@/contexts/UsuarioContext";

type Aba = "grupos" | "pessoal";

const vazioDashboard: Dashboard = {
  receber: 0, pagar: 0, total_grupos: 0, total_gasto_grupos: 0,
  total_gasto_pessoal: 0, total_gasto_geral: 0, total_despesas_grupos: 0,
  lembretes_proximos: [],
};

const moeda = (valor: number) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
const dataCurta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export default function Home() {
  const { usuario } = useUsuario();
  const [abaSelecionada, setAbaSelecionada] = useState<Aba>("pessoal");
  const [dashboard, setDashboard] = useState<Dashboard>(vazioDashboard);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const [resumo, gruposResposta, despesasResposta] = await Promise.all([
          dashboardApi.obter(),
          gruposApi.listar(),
          despesasPessoaisApi.listar({ tipo: "despesa" }),
        ]);
        if (!ativo) return;
        setDashboard(resumo.data);
        setGrupos(gruposResposta.data.slice(0, 3));
        setDespesas(despesasResposta.data.slice(0, 3));
      } catch (erro) {
        if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar a tela inicial.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []));

  if (!usuario) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.hello}>Olá,</Text><Text style={styles.userName}>{usuario.nome}</Text></View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push("/(main)/gerenciamento-perfil")}><Text style={styles.avatarText}>{usuario.iniciais}</Text></TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Gasto total</Text>
          <Text style={styles.balanceValue}>{moeda(dashboard.total_gasto_geral)}</Text>
          <View style={styles.balanceIndicators}>
            <Text style={styles.positivePill}>↑ {moeda(dashboard.receber)} a receber</Text>
            <Text style={styles.negativePill}>↓ {moeda(dashboard.pagar)} a pagar</Text>
          </View>
        </View>

        <View style={styles.segmentContainer}>
          <TouchableOpacity style={[styles.segment, abaSelecionada === "pessoal" && styles.segmentActive]} onPress={() => setAbaSelecionada("pessoal")}><Text style={[styles.segmentText, abaSelecionada === "pessoal" && styles.segmentTextActive]}>Pessoal</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.segment, abaSelecionada === "grupos" && styles.segmentActive]} onPress={() => setAbaSelecionada("grupos")}><Text style={[styles.segmentText, abaSelecionada === "grupos" && styles.segmentTextActive]}>Em grupo</Text></TouchableOpacity>
        </View>

        {carregando ? <ActivityIndicator color="#00C896" style={{ marginTop: 48 }} /> : abaSelecionada === "grupos" ? (
          <View style={styles.content}>
            <View style={styles.titleRow}><Text style={styles.sectionTitle}>Seus grupos</Text><Text style={styles.count}>{dashboard.total_grupos}</Text></View>
            {grupos.length === 0 ? <Text style={styles.empty}>Você ainda não participa de grupos.</Text> : grupos.map((grupo) => (
              <TouchableOpacity key={grupo.id} style={styles.card} onPress={() => router.push({ pathname: "/(main)/group/despesas-grupo", params: { groupId: String(grupo.id), grupoNome: grupo.nome } })}>
                <View style={styles.groupAvatar}><Text style={styles.groupAvatarText}>{iniciais(grupo.nome)}</Text></View>
                <View style={styles.cardInfo}><Text style={styles.cardTitle}>{grupo.nome}</Text><Text style={styles.cardMeta}>{grupo.descricao || "Despesas compartilhadas"}</Text></View><Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push("/(main)/group")}><Text style={styles.link}>Ver todos os grupos</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.titleRow}><Text style={styles.sectionTitle}>Despesas pessoais</Text><Text style={styles.count}>{despesas.length}</Text></View>
            {despesas.length === 0 ? <Text style={styles.empty}>Nenhuma despesa pessoal registrada.</Text> : despesas.map((despesa) => (
              <TouchableOpacity key={despesa.id} style={styles.card} onPress={() => router.push({ pathname: "/(main)/personal/detalhes-despesa-pessoal", params: { id: String(despesa.id) } })}>
                <View style={styles.personalAvatar}><Text>💳</Text></View>
                <View style={styles.cardInfo}><Text style={styles.cardTitle}>{despesa.descricao}</Text><Text style={styles.cardMeta}>{despesa.categoria || "Outros"} · {dataCurta(despesa.data_despesa)}</Text></View><Text style={styles.value}>{moeda(despesa.valor)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push("/(main)/personal/despesas-pessoais")}><Text style={styles.link}>Ver todas as despesas</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push(abaSelecionada === "pessoal" ? "/(main)/personal/nova-despesa-pessoal" : "/(main)/group")}><Text style={styles.fabText}>+</Text></TouchableOpacity>
      <View style={styles.bottomNavigation}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace("/(main)/home")}><Text style={styles.navActive}>⌂</Text><Text style={styles.navTextActive}>Início</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/(main)/group")}><Text style={styles.navIcon}>👥</Text><Text style={styles.navText}>Grupos</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/(main)/personal/despesas-pessoais")}><Text style={styles.navIcon}>💳</Text><Text style={styles.navText}>Despesas</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/(main)/gerenciamento-perfil")}><Text style={styles.navIcon}>👤</Text><Text style={styles.navText}>Perfil</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" }, scroll: { padding: 18, paddingBottom: 105 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, hello: { color: "#6B8F86", fontSize: 12 }, userName: { color: "#0B3B33", fontSize: 20, fontWeight: "700" }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#0B3B33", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#FFF", fontWeight: "700" }, balanceCard: { marginTop: 25, backgroundColor: "#0B3B33", padding: 22, borderRadius: 22 }, balanceLabel: { color: "#BFE0D6", fontSize: 13 }, balanceValue: { color: "#FFF", fontSize: 29, fontWeight: "700", marginTop: 6 }, balanceIndicators: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, positivePill: { backgroundColor: "#DEF7EC", color: "#00A17A", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" }, negativePill: { backgroundColor: "#FFE7E2", color: "#D24A3B", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" }, segmentContainer: { marginTop: 16, flexDirection: "row", backgroundColor: "#EAF5F0", borderRadius: 12, padding: 3 }, segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 }, segmentActive: { backgroundColor: "#0B3B33" }, segmentText: { color: "#6B8F86", fontWeight: "600" }, segmentTextActive: { color: "#FFF" }, content: { marginTop: 22 }, titleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }, sectionTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 16 }, count: { color: "#6B8F86", fontWeight: "700" }, card: { minHeight: 68, borderWidth: 1, borderColor: "#E1EEE8", backgroundColor: "#FFF", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 10 }, groupAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#00C896", alignItems: "center", justifyContent: "center" }, personalAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF7F3", alignItems: "center", justifyContent: "center" }, groupAvatarText: { color: "#0B3B33", fontWeight: "800" }, cardInfo: { flex: 1, marginLeft: 10 }, cardTitle: { color: "#0B3B33", fontWeight: "700" }, cardMeta: { color: "#6B8F86", fontSize: 11, marginTop: 3 }, value: { color: "#0B3B33", fontWeight: "700", fontSize: 12 }, arrow: { color: "#6B8F86", fontSize: 25 }, empty: { color: "#6B8F86", textAlign: "center", paddingVertical: 28 }, link: { color: "#00A17A", fontWeight: "700", textAlign: "center", padding: 12 }, fab: { position: "absolute", right: 20, bottom: 82, width: 54, height: 54, borderRadius: 18, backgroundColor: "#00C896", alignItems: "center", justifyContent: "center", elevation: 6 }, fabText: { color: "#0B3B33", fontSize: 28 }, bottomNavigation: { height: 68, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E1EEE8", flexDirection: "row", justifyContent: "space-around", alignItems: "center" }, navItem: { alignItems: "center", minWidth: 60 }, navActive: { color: "#00A17A", fontSize: 20 }, navIcon: { fontSize: 17 }, navText: { color: "#6B8F86", fontSize: 10, marginTop: 3 }, navTextActive: { color: "#00A17A", fontWeight: "700", fontSize: 10, marginTop: 3 },
});
