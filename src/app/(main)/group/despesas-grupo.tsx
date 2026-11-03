import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasGrupoApi } from "@/services/api";
import type { DespesaGrupo } from "@/types/api";

const CORES = { paper: "#F5FBF7", ink: "#0B3B33", surface: "#FFFFFF", accent: "#00C896", accentDark: "#00A17A", muted: "#6B8F86", line: "#E1EEE8", field: "#F0F8F4" };
const ICONES_CATEGORIA: Record<string, string> = { "Alimentação": "🍽️", Transporte: "🚕", Casa: "🏠", Moradia: "🏘️", Saúde: "💊", Educação: "📚", Lazer: "🎮", Assinatura: "🎬", Assinaturas: "🎬", Compras: "🛍️", Pets: "🐾", Viagem: "✈️", Impostos: "🧾", Mercado: "🛒", "Contas da casa": "💡", "Internet e telefone": "📶", Limpeza: "🧹", "Manutenção e reparos": "🔧", Hospedagem: "🏨", Passagens: "✈️", Combustível: "⛽", "Pedágios e estacionamento": "🅿️", "Passeios e ingressos": "🎟️", Outros: "📦" };
const CORES_CATEGORIA: Record<string, string> = {
  Alimentação: "#00C896",
  Transporte: "#FF6B5C",
  Assinatura: "#4C8DFF",
  Assinaturas: "#4C8DFF",
  Casa: "#FFB454",
  Moradia: "#FFB454",
  Lazer: "#B18CFF",
  Saúde: "#55BFA4",
  Educação: "#7C8CFF",
  Compras: "#6B8F86",
  Pets: "#F58DAA",
  Viagem: "#52A7D8",
  Impostos: "#A86F47",
  Mercado: "#E6A23C",
  "Contas da casa": "#3D9B83",
  "Internet e telefone": "#D97745",
  Limpeza: "#5B9C72",
  "Manutenção e reparos": "#B8754D",
  Hospedagem: "#527D9A",
  Passagens: "#C26A8A",
  Combustível: "#8C6D9C",
  "Pedágios e estacionamento": "#76923C",
  "Passeios e ingressos": "#C27C36",
  Outros: "#A6BDB5",
};

const moeda = (valor: number | string) => {
  const numero = Number(valor);
  return (Number.isFinite(numero) ? numero : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const dataCriacao = (valor: string | null | undefined) => {
  if (!valor) return null;

  const correspondencia = valor.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!correspondencia) return null;

  const [, ano, mes, dia, hora, minuto, segundo = "0", fuso] = correspondencia;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() !== Number(mes) - 1 ||
    data.getUTCDate() !== Number(dia) ||
    Number(hora) > 23 ||
    Number(minuto) > 59 ||
    Number(segundo) > 59
  ) return null;

  if (!fuso) return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;

  const instante = new Date(valor.trim().replace(" ", "T"));
  if (Number.isNaN(instante.getTime())) return null;
  return instante.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).replace(", ", " às ");
};
const iconeCategoria = (categoria: string | null | undefined) => (categoria && ICONES_CATEGORIA[categoria]) || "📦";

export default function DespesasGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [filtro, setFiltro] = useState<"Todas" | "Recentes">("Todas");
  const [despesas, setDespesas] = useState<DespesaGrupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregarDespesas = useCallback(async (mostrarLoading = true) => {
    if (!groupId || Number(groupId) <= 0) { setCarregando(false); return; }
    if (mostrarLoading) setCarregando(true); else setAtualizando(true);
    try {
      const resposta = await despesasGrupoApi.listar(Number(groupId));
      setDespesas(resposta.data);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar as despesas do grupo.");
    } finally { setCarregando(false); setAtualizando(false); }
  }, [groupId]);

  useFocusEffect(useCallback(() => { carregarDespesas(); }, [carregarDespesas]));

  const despesasExibidas = useMemo(() => filtro === "Recentes" ? despesas.slice(0, 2) : despesas, [despesas, filtro]);
  const resumoCategorias = useMemo(() => {
    const agrupamento = new Map<string, number>();

    despesas.forEach((despesa) => {
      const valor = Number(despesa.valor);
      if (!Number.isFinite(valor) || valor <= 0) return;

      const categoria = despesa.categoria?.trim() || "Outros";
      const soma = (agrupamento.get(categoria) ?? 0) + valor;
      if (Number.isFinite(soma)) agrupamento.set(categoria, soma);
    });

    return Array.from(agrupamento, ([categoria, valor]) => ({
      categoria,
      valor,
      cor: CORES_CATEGORIA[categoria] ?? CORES_CATEGORIA.Outros,
    }));
  }, [despesas]);
  const totalCategorias = resumoCategorias.reduce((soma, item) => {
    const total = soma + item.valor;
    return Number.isFinite(total) ? total : soma;
  }, 0);

  function abrirDespesa(id: number | string) {
    router.push({ pathname: "/(main)/group/detalhes-despesa", params: { id: String(id), groupId, grupoNome } });
  }
  function abrirNovaDespesa() {
    router.push({ pathname: "/(main)/group/nova-despesa", params: { groupId, grupoNome } });
  }
  function abrirParticipantes() {
    router.push({ pathname: "/(main)/group/participantes", params: { groupId, grupoNome } });
  }
  function abrirSaldos() {
    router.push({ pathname: "/(main)/group/saldos", params: { groupId, grupoNome } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}><Text style={styles.iconeVoltar}>‹</Text></TouchableOpacity>
        <View style={styles.headerTextos}><Text style={styles.titulo}>Despesas em grupo</Text><Text style={styles.subtitulo}>{grupoNome}</Text></View>
        <TouchableOpacity style={styles.botaoParticipantes} onPress={abrirParticipantes} accessibilityLabel="Ver participantes"><Text style={styles.iconeParticipantes}>👥</Text></TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregarDespesas(false)} tintColor={CORES.accentDark} />}>
        <View style={styles.cardResumo}>
          <View style={styles.grupoChip}><Text style={styles.grupoChipTexto}>Grupo · {grupoNome}</Text></View>
          <Text style={styles.resumoLabel}>Total de despesas</Text>
          <Text style={styles.resumoValor}>{moeda(totalCategorias)}</Text>
          <Text style={styles.resumoNota}>{despesas.length} {despesas.length === 1 ? "despesa registrada" : "despesas registradas"}</Text>
          {totalCategorias > 0 && <View style={styles.barraCategorias}>
            {resumoCategorias.map((item) => <View key={item.categoria} style={[styles.segmentoCategoria, { flex: item.valor / totalCategorias, backgroundColor: item.cor }]} />)}
          </View>}
        </View>

        <View style={styles.linhaTitulo}><Text style={styles.secaoTitulo}>Movimentações</Text><Text style={styles.quantidade}>{despesasExibidas.length}</Text></View>
        <View style={styles.filtros}>
          {(["Todas", "Recentes"] as const).map((item) => <TouchableOpacity key={item} style={[styles.filtro, filtro === item && styles.filtroAtivo]} onPress={() => setFiltro(item)}><Text style={[styles.filtroTexto, filtro === item && styles.filtroTextoAtivo]}>{item}</Text></TouchableOpacity>)}
        </View>

        {carregando ? <View style={styles.estado}><ActivityIndicator size="large" color={CORES.accentDark} /><Text style={styles.estadoTexto}>Carregando despesas...</Text></View>
          : despesasExibidas.length === 0 ? <View style={styles.vazio}><Text style={styles.vazioIcone}>🧾</Text><Text style={styles.vazioTitulo}>Nenhuma despesa registrada</Text><Text style={styles.vazioTexto}>Adicione a primeira despesa compartilhada deste grupo.</Text></View>
          : <View style={styles.listaDespesas}>{despesasExibidas.map((item) => {
            const categoria = item.categoria?.trim() || "Outros";
            const criadaEm = dataCriacao(item.criado_em);
            const participantesCount = item.participantes_count ?? item.divisoes?.length ?? 0;

            return <TouchableOpacity key={item.id} style={styles.cartaoDespesa} onPress={() => abrirDespesa(item.id)} activeOpacity={0.8} accessibilityRole="button">
              <View style={styles.cartaoDespesaConteudo}>
                <View style={styles.cartaoDespesaTopo}>
                  <Text style={styles.despesaTitulo} numberOfLines={1}>{iconeCategoria(categoria)} {item.descricao}</Text>
                  <Text style={styles.despesaValor}>{moeda(item.valor)}</Text>
                </View>
                <Text style={styles.despesaInfo} numberOfLines={1}>{categoria}</Text>
                {criadaEm && <Text style={styles.despesaCriadaEm}>Criada em {criadaEm}</Text>}
                <View style={styles.cartaoDespesaRodape}>
                  <Text style={styles.pagador}>Pago por {item.pagador_nome || "Participante"}</Text>
                  <View style={styles.participantesChip}>
                    <Text style={styles.participantesChipTexto}>{participantesCount} {participantesCount === 1 ? "pessoa" : "pessoas"}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>;
          })}</View>}

        <View style={styles.acoesSecundarias}>
          <TouchableOpacity style={styles.acaoSecundaria} onPress={abrirParticipantes}><Text style={styles.acaoIcone}>👥</Text><Text style={styles.acaoTexto}>Participantes</Text><Text style={styles.seta}>›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.acaoSecundaria} onPress={abrirSaldos}><Text style={styles.acaoIcone}>⚖️</Text><Text style={styles.acaoTexto}>Saldos e acertos</Text><Text style={styles.seta}>›</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={abrirNovaDespesa} accessibilityLabel="Nova despesa"><Text style={styles.fabText}>+</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CORES.paper },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, justifyContent: "center", alignItems: "center", marginRight: 12 },
  iconeVoltar: { fontSize: 32, color: CORES.ink, lineHeight: 34, marginTop: -3 }, headerTextos: { flex: 1 },
  titulo: { fontSize: 23, fontWeight: "700", color: CORES.ink }, subtitulo: { fontSize: 12, color: CORES.muted, marginTop: 4 },
  botaoParticipantes: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E8F9F2", justifyContent: "center", alignItems: "center" }, iconeParticipantes: { fontSize: 18 },
  scroll: { flex: 1 }, conteudo: { paddingHorizontal: 20, paddingBottom: 122 },
  cardResumo: { backgroundColor: CORES.field, borderRadius: 16, padding: 14, marginBottom: 18 },
  grupoChip: { alignSelf: "flex-start", backgroundColor: "#DDF7EE", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 10 }, grupoChipTexto: { color: CORES.ink, fontSize: 10, fontWeight: "700" },
  resumoLabel: { fontSize: 11, color: CORES.muted }, resumoValor: { marginTop: 5, fontSize: 25, fontWeight: "600", color: CORES.ink }, resumoNota: { marginTop: 5, fontSize: 11, color: CORES.muted },
  barraCategorias: { flexDirection: "row", height: 6, borderRadius: 4, overflow: "hidden", gap: 2, marginTop: 12 },
  segmentoCategoria: { height: 6, borderRadius: 3 },
  linhaTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, secaoTitulo: { color: CORES.ink, fontSize: 16, fontWeight: "700" }, quantidade: { minWidth: 22, textAlign: "center", color: CORES.muted, fontSize: 11, fontWeight: "700" },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 8 }, filtro: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line }, filtroAtivo: { backgroundColor: "#DDF7EE", borderColor: CORES.accent }, filtroTexto: { color: CORES.muted, fontSize: 11, fontWeight: "600" }, filtroTextoAtivo: { color: CORES.ink },
  listaDespesas: { marginTop: 2 },
  cartaoDespesa: { backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, borderRadius: 14, marginBottom: 10 },
  cartaoDespesaConteudo: { padding: 12 },
  cartaoDespesaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  despesaTitulo: { flex: 1, minWidth: 0, color: CORES.ink, fontSize: 13, fontWeight: "700" },
  despesaInfo: { color: CORES.muted, fontSize: 11, marginTop: 4 },
  despesaCriadaEm: { color: CORES.muted, fontSize: 10, marginTop: 3 },
  despesaValor: { flexShrink: 0, color: CORES.ink, fontSize: 12, fontWeight: "700" },
  cartaoDespesaRodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  pagador: { flex: 1, color: CORES.muted, fontSize: 10 },
  participantesChip: { backgroundColor: CORES.field, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  participantesChipTexto: { color: CORES.ink, fontSize: 9, fontWeight: "700" },
  estado: { paddingTop: 60, alignItems: "center" }, estadoTexto: { color: CORES.muted, fontSize: 12, marginTop: 12 }, vazio: { paddingTop: 55, paddingHorizontal: 25, alignItems: "center" }, vazioIcone: { fontSize: 36, marginBottom: 12 }, vazioTitulo: { color: CORES.ink, fontSize: 14, fontWeight: "700" }, vazioTexto: { color: CORES.muted, fontSize: 11, textAlign: "center", lineHeight: 17, marginTop: 7 },
  acoesSecundarias: { gap: 10, marginTop: 14 }, acaoSecundaria: { backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center" }, acaoIcone: { fontSize: 19, marginRight: 12 }, acaoTexto: { flex: 1, color: CORES.ink, fontWeight: "700", fontSize: 13 }, seta: { color: CORES.accentDark, fontSize: 24, marginTop: -2 },
  fab: { position: "absolute", right: 20, bottom: 82, width: 54, height: 54, borderRadius: 18, backgroundColor: CORES.accent, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: CORES.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9 }, fabText: { color: CORES.ink, fontSize: 28, fontWeight: "600", marginTop: -2 },
});
