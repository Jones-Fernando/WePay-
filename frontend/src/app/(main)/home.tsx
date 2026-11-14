import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { formatDateForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";

type Aba = "grupos" | "pessoal";

const vazioDashboard: Dashboard = {
  receber: 0, pagar: 0, total_grupos: 0, total_gasto_grupos: 0,
  total_gasto_pessoal: 0, total_gasto_geral: 0, total_despesas_grupos: 0,
  lembretes_proximos: [],
};

const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
const iconesCategoria: Record<string, string> = {
  "Alimentação": "🛒",
  Transporte: "🚕",
  Casa: "🏠",
  Moradia: "🏘️",
  Lazer: "🎮",
  Assinatura: "🎬",
  Assinaturas: "🎬",
  Saúde: "💊",
  Educação: "📚",
  Compras: "🛍️",
  Pets: "🐾",
  Viagem: "✈️",
  Impostos: "🧾",
  Outros: "📦",
};
const iconeCategoria = (categoria: string | null | undefined) =>
  (categoria && iconesCategoria[categoria]) || "📦";

function textoVencimento(dias: number): string {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

export default function Home() {
  const { usuario, atualizarSaldoTotal } = useUsuario();
  const [abaSelecionada, setAbaSelecionada] = useState<Aba>("pessoal");
  const [dashboard, setDashboard] = useState<Dashboard>(vazioDashboard);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const telaAtiva = useRef(false);

  const carregar = useCallback(async () => {
    if (!telaAtiva.current) return;
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const [resumo, gruposResposta, despesasResposta] = await Promise.all([
        dashboardApi.obter(),
        gruposApi.listar({ limit: 3, offset: 0 }),
        despesasPessoaisApi.listar({ tipo: "despesa", limit: 3, offset: 0 }),
      ]);
      if (!telaAtiva.current) return;
      setDashboard(resumo.data);
      atualizarSaldoTotal(Number(resumo.data.receber) - Number(resumo.data.pagar));
      setGrupos(gruposResposta.data.slice(0, 3));
      setDespesas(despesasResposta.data.slice(0, 3));
    } catch (erro) {
      if (telaAtiva.current) {
        setErroCarregamento(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar a tela inicial.",
        );
      }
    } finally {
      if (telaAtiva.current) setCarregando(false);
    }
  }, [atualizarSaldoTotal]);

  useFocusEffect(useCallback(() => {
    telaAtiva.current = true;
    void carregar();
    return () => { telaAtiva.current = false; };
  }, [carregar]));

  if (!usuario) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.hello}>Olá,</Text><Text style={styles.userName}>{usuario.nome}</Text></View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Abrir notificações"
              style={styles.notificationButton}
              onPress={() => router.push("/(main)/notificacoes")}
            >
              <Text style={styles.notificationIcon}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push("/(main)/gerenciamento-perfil")}><Text style={styles.avatarText}>{usuario.iniciais}</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Gasto total</Text>
          <Text style={styles.balanceValue}>{formatCurrencyBRL(dashboard.total_gasto_geral)}</Text>
          <View style={styles.balanceIndicators}>
            <Text style={styles.positivePill}>↑ {formatCurrencyBRL(dashboard.receber)} a receber</Text>
            <Text style={styles.negativePill}>↓ {formatCurrencyBRL(dashboard.pagar)} a pagar</Text>
          </View>
        </View>

        {dashboard.lembretes_proximos.length > 0 && (
          <View style={reminderStyles.remindersSection}>
            <Text style={reminderStyles.remindersTitle}>Próximos vencimentos</Text>
            {dashboard.lembretes_proximos.slice(0, 3).map((lembrete) => (
              <TouchableOpacity
                key={`${lembrete.grupo_id}-${lembrete.despesa_id}`}
                style={reminderStyles.reminderCard}
                accessibilityRole="button"
                accessibilityLabel={`${lembrete.descricao}, ${lembrete.status === "a_pagar" ? "a pagar" : "a receber"}, ${textoVencimento(lembrete.dias_para_vencer)}`}
                onPress={() => router.push({
                  pathname: "/(main)/group/despesas-grupo",
                  params: { groupId: String(lembrete.grupo_id), grupoNome: lembrete.grupo_nome },
                })}
              >
                <View style={reminderStyles.reminderInfo}>
                  <Text style={reminderStyles.reminderDescription} numberOfLines={1}>{lembrete.descricao}</Text>
                  <Text style={reminderStyles.reminderMeta}>
                    {lembrete.grupo_nome} · {textoVencimento(lembrete.dias_para_vencer)}
                  </Text>
                </View>
                <View style={reminderStyles.reminderAmount}>
                  <Text style={lembrete.status === "a_pagar" ? reminderStyles.reminderPay : reminderStyles.reminderReceive}>
                    {lembrete.status === "a_pagar" ? "A pagar" : "A receber"}
                  </Text>
                  <Text style={reminderStyles.reminderValue}>{formatCurrencyBRL(lembrete.valor)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.segmentContainer}>
          <TouchableOpacity style={[styles.segment, abaSelecionada === "pessoal" && styles.segmentActive]} onPress={() => setAbaSelecionada("pessoal")}><Text style={[styles.segmentText, abaSelecionada === "pessoal" && styles.segmentTextActive]}>Pessoal</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.segment, abaSelecionada === "grupos" && styles.segmentActive]} onPress={() => setAbaSelecionada("grupos")}><Text style={[styles.segmentText, abaSelecionada === "grupos" && styles.segmentTextActive]}>Em grupo</Text></TouchableOpacity>
        </View>

        {carregando ? <ActivityIndicator color="#00C896" style={{ marginTop: 48 }} /> : erroCarregamento ? (
          <View style={styles.loadError} accessibilityRole="alert">
            <Text style={styles.empty}>Não foi possível carregar a tela inicial.</Text>
            <Text style={styles.errorMessage}>{erroCarregamento}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void carregar()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : abaSelecionada === "grupos" ? (
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
                <View style={styles.personalAvatar}><Text style={styles.categoryEmoji} accessible={false}>{iconeCategoria(despesa.categoria)}</Text></View>
                <View style={styles.cardInfo}><Text style={styles.cardTitle}>{despesa.descricao}</Text><Text style={styles.cardMeta}>{despesa.categoria || "Outros"} · {formatDateForDisplay(despesa.data_despesa, { day: "2-digit", month: "short" })}</Text></View><Text style={styles.value}>{formatCurrencyBRL(despesa.valor)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push("/(main)/personal/despesas-pessoais")}><Text style={styles.link}>Ver todas as despesas</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push(abaSelecionada === "pessoal" ? "/(main)/personal/despesas-pessoais" : "/(main)/group")}><Text style={styles.fabText}>+</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" }, scroll: { padding: 18, paddingBottom: 90 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 10 }, notificationButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: "#E1EEE8", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, notificationIcon: { color: "#0B3B33", fontSize: 25, fontWeight: "700" }, hello: { color: "#6B8F86", fontSize: 12 }, userName: { color: "#0B3B33", fontSize: 20, fontWeight: "700" }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#0B3B33", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#FFF", fontWeight: "700" }, balanceCard: { marginTop: 25, backgroundColor: "#0B3B33", padding: 22, borderRadius: 22 }, balanceLabel: { color: "#BFE0D6", fontSize: 13 }, balanceValue: { color: "#FFF", fontSize: 29, fontWeight: "700", marginTop: 6 }, balanceIndicators: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, positivePill: { backgroundColor: "#DEF7EC", color: "#00A17A", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" }, negativePill: { backgroundColor: "#FFE7E2", color: "#D24A3B", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" }, segmentContainer: { marginTop: 16, flexDirection: "row", backgroundColor: "#EAF5F0", borderRadius: 12, padding: 3 }, segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 }, segmentActive: { backgroundColor: "#0B3B33" }, segmentText: { color: "#6B8F86", fontWeight: "600" }, segmentTextActive: { color: "#FFF" }, content: { marginTop: 22 }, titleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }, sectionTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 16 }, count: { color: "#6B8F86", fontWeight: "700" }, card: { minHeight: 68, borderWidth: 1, borderColor: "#E1EEE8", backgroundColor: "#FFF", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 10 }, groupAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#00C896", alignItems: "center", justifyContent: "center" }, personalAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EAF7F3", alignItems: "center", justifyContent: "center" }, categoryEmoji: { fontSize: 23, lineHeight: 28, textAlign: "center" }, groupAvatarText: { color: "#0B3B33", fontWeight: "800" }, cardInfo: { flex: 1, marginLeft: 10 }, cardTitle: { color: "#0B3B33", fontWeight: "700" }, cardMeta: { color: "#6B8F86", fontSize: 11, marginTop: 3 }, value: { color: "#0B3B33", fontWeight: "700", fontSize: 12 }, arrow: { color: "#6B8F86", fontSize: 25 }, empty: { color: "#6B8F86", textAlign: "center", paddingVertical: 28 }, link: { color: "#00A17A", fontWeight: "700", textAlign: "center", padding: 12 }, fab: { position: "absolute", right: 20, bottom: 20, width: 54, height: 54, borderRadius: 18, backgroundColor: "#00C896", alignItems: "center", justifyContent: "center", elevation: 6 }, fabText: { color: "#0B3B33", fontSize: 28 },
  loadError: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 },
  errorMessage: { color: "#6B8F86", textAlign: "center", marginTop: 8 },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: "#DDF7EE" },
  retryText: { color: "#087F5B", fontWeight: "700" },
});

const reminderStyles = StyleSheet.create({
  remindersSection: { marginTop: 18 },
  remindersTitle: { color: "#0B3B33", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  reminderCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    backgroundColor: "#FFFFFF",
  },
  reminderInfo: { flex: 1, marginRight: 8 },
  reminderDescription: { color: "#0B3B33", fontSize: 13, fontWeight: "700" },
  reminderMeta: { color: "#6B8F86", fontSize: 11, marginTop: 4 },
  reminderAmount: { alignItems: "flex-end" },
  reminderPay: { color: "#D24A3B", fontSize: 10, fontWeight: "700" },
  reminderReceive: { color: "#00A17A", fontSize: 10, fontWeight: "700" },
  reminderValue: { color: "#0B3B33", fontSize: 12, fontWeight: "700", marginTop: 3 },
});
