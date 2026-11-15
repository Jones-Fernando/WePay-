import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import type { DespesaGrupo, PaginacaoLista } from "@/types/api";
import { formatDateTimeForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import {
  appendUniqueById,
  createPaginationRequestGate,
} from "@/utils/paginationRequestGate";

const CORES = { paper: "#F5FBF7", ink: "#0B3B33", surface: "#FFFFFF", accent: "#00C896", accentDark: "#00A17A", muted: "#6B8F86", line: "#E1EEE8", field: "#F0F8F4" };
const ICONES_CATEGORIA: Record<string, string> = { "Alimentação": "🛒", Transporte: "🚕", Casa: "🏠", Moradia: "🏘️", Saúde: "💊", Educação: "📚", Lazer: "🎮", Assinatura: "🎬", Assinaturas: "🎬", Compras: "🛍️", Pets: "🐾", Viagem: "✈️", Impostos: "🧾", Mercado: "🛒", "Contas da casa": "💡", "Internet e telefone": "📶", Limpeza: "🧹", "Manutenção e reparos": "🔧", Hospedagem: "🏨", Passagens: "✈️", Combustível: "⛽", "Pedágios e estacionamento": "🅿️", "Passeios e ingressos": "🎟️", Outros: "📦" };
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

const iconeCategoria = (categoria: string | null | undefined) => (categoria && ICONES_CATEGORIA[categoria]) || "📦";
const TAMANHO_PAGINA = 50;

export default function DespesasGrupo() {
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const [filtro, setFiltro] = useState<"Todas" | "Recentes">("Todas");
  const [despesas, setDespesas] = useState<DespesaGrupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [paginacao, setPaginacao] = useState<PaginacaoLista | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [erroCarregamentoMais, setErroCarregamentoMais] = useState<string | null>(null);
  const requestGate = useRef(createPaginationRequestGate());

  const carregarDespesas = useCallback(async (mostrarLoading = true) => {
    const generation = requestGate.current.beginFirstPage();
    setCarregandoMais(false);
    setErroCarregamento(null);
    setErroCarregamentoMais(null);
    if (!groupId || Number(groupId) <= 0) {
      setDespesas([]);
      setPaginacao(null);
      setCarregando(false);
      setAtualizando(false);
      requestGate.current.finishFirstPage(generation);
      return;
    }
    if (mostrarLoading) setCarregando(true); else setAtualizando(true);
    try {
      const resposta = await despesasGrupoApi.listar(Number(groupId), {
        limit: TAMANHO_PAGINA,
        offset: 0,
      });
      if (!requestGate.current.isCurrent(generation)) return;
      setDespesas(resposta.data);
      setPaginacao(resposta.paginacao);
    } catch (erro) {
      if (requestGate.current.isCurrent(generation)) {
        setErroCarregamento(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar as despesas do grupo.",
        );
      }
    } finally {
      if (requestGate.current.isCurrent(generation)) {
        requestGate.current.finishFirstPage(generation);
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => {
    requestGate.current.activate();
    void carregarDespesas();
    return () => requestGate.current.invalidate();
  }, [carregarDespesas]));

  const carregarMais = useCallback(async () => {
    if (!paginacao?.has_more || !groupId) return;
    const ticket = requestGate.current.beginNextPage();
    if (!ticket) return;
    setCarregandoMais(true);
    setErroCarregamentoMais(null);
    try {
      const resposta = await despesasGrupoApi.listar(Number(groupId), {
        limit: TAMANHO_PAGINA,
        offset: despesas.length,
      });
      if (!requestGate.current.isCurrentPage(ticket)) return;
      setDespesas((atuais) => appendUniqueById(atuais, resposta.data));
      setPaginacao(resposta.paginacao);
    } catch (erro) {
      if (requestGate.current.isCurrentPage(ticket)) {
        setErroCarregamentoMais(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar mais despesas.",
        );
      }
    } finally {
      if (requestGate.current.isCurrentPage(ticket)) {
        requestGate.current.finishNextPage(ticket);
        setCarregandoMais(false);
      }
    }
  }, [despesas.length, groupId, paginacao]);

  const despesasExibidas = useMemo(() => filtro === "Recentes" ? despesas.slice(0, 2) : despesas, [despesas, filtro]);
  const resumoCategorias = useMemo(
    () =>
      (paginacao?.categorias ?? [])
        .filter((item) => Number(item.valor) > 0)
        .map((item) => {
          const categoria = item.categoria?.trim() || "Outros";
          return {
            categoria,
            valor: Number(item.valor),
            cor: CORES_CATEGORIA[categoria] ?? CORES_CATEGORIA.Outros,
          };
        }),
    [paginacao]
  );
  const totalCategorias = Number(paginacao?.valor_total ?? 0);

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
        {erroCarregamento && despesas.length > 0 && (
          <View style={styles.erroInline} accessibilityRole="alert">
            <Text style={styles.erroTexto}>{erroCarregamento}</Text>
            <TouchableOpacity
              onPress={() => void carregarDespesas(false)}
              disabled={atualizando}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar despesas novamente"
            >
              <Text style={styles.erroAcao}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.cardResumo}>
          <View style={styles.grupoChip}><Text style={styles.grupoChipTexto}>Grupo · {grupoNome}</Text></View>
          <Text style={styles.resumoLabel}>Total de despesas</Text>
          <Text style={styles.resumoValor}>{formatCurrencyBRL(totalCategorias)}</Text>
          <Text style={styles.resumoNota}>{paginacao?.total ?? despesas.length} {(paginacao?.total ?? despesas.length) === 1 ? "despesa registrada" : "despesas registradas"}</Text>
          {totalCategorias > 0 && <View style={styles.barraCategorias}>
            {resumoCategorias.map((item) => <View key={item.categoria} style={[styles.segmentoCategoria, { flex: item.valor / totalCategorias, backgroundColor: item.cor }]} />)}
          </View>}
        </View>

        <View style={styles.linhaTitulo}><Text style={styles.secaoTitulo}>Movimentações</Text><Text style={styles.quantidade}>{despesasExibidas.length}</Text></View>
        <View style={styles.filtros}>
          {(["Todas", "Recentes"] as const).map((item) => <TouchableOpacity key={item} style={[styles.filtro, filtro === item && styles.filtroAtivo]} onPress={() => setFiltro(item)}><Text style={[styles.filtroTexto, filtro === item && styles.filtroTextoAtivo]}>{item}</Text></TouchableOpacity>)}
        </View>

        {carregando ? <View style={styles.estado}><ActivityIndicator size="large" color={CORES.accentDark} /><Text style={styles.estadoTexto}>Carregando despesas...</Text></View>
          : erroCarregamento && despesas.length === 0 ? <View style={styles.estadoErro} accessibilityRole="alert"><Text style={styles.vazioTitulo}>Não foi possível carregar as despesas</Text><Text style={styles.vazioTexto}>{erroCarregamento}</Text><TouchableOpacity style={styles.botaoTentarNovamente} onPress={() => void carregarDespesas()} accessibilityRole="button"><Text style={styles.textoCarregarMais}>Tentar novamente</Text></TouchableOpacity></View>
          : despesasExibidas.length === 0 ? <View style={styles.vazio}><Text style={styles.vazioIcone}>🧾</Text><Text style={styles.vazioTitulo}>Nenhuma despesa registrada</Text><Text style={styles.vazioTexto}>Adicione a primeira despesa compartilhada deste grupo.</Text></View>
          : <View style={styles.listaDespesas}>{despesasExibidas.map((item) => {
            const categoria = item.categoria?.trim() || "Outros";
            const criadaEm = item.criado_em
              ? formatDateTimeForDisplay(item.criado_em)
              : null;
            const participantesCount = item.participantes_count ?? item.divisoes?.length ?? 0;

            return <TouchableOpacity key={item.id} style={styles.cartaoDespesa} onPress={() => abrirDespesa(item.id)} activeOpacity={0.8} accessibilityRole="button">
              <View style={styles.cartaoDespesaConteudo}>
                <View style={styles.cartaoDespesaTopo}>
                  <Text style={styles.despesaTitulo} numberOfLines={1}>{iconeCategoria(categoria)} {item.descricao}</Text>
                  <Text style={styles.despesaValor}>{formatCurrencyBRL(item.valor)}</Text>
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

        {filtro === "Todas" && !carregando && paginacao?.has_more && (
          erroCarregamentoMais ? (
            <View style={styles.erroPaginacao} accessibilityRole="alert">
              <Text style={styles.erroTexto}>{erroCarregamentoMais}</Text>
              <TouchableOpacity
                style={styles.botaoCarregarMais}
                onPress={() => void carregarMais()}
                disabled={carregandoMais}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar mais despesas novamente"
              >
                <Text style={styles.textoCarregarMais}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.botaoCarregarMais}
              onPress={() => void carregarMais()}
              disabled={carregandoMais}
              accessibilityRole="button"
            >
              {carregandoMais
                ? <ActivityIndicator color={CORES.accentDark} />
                : <Text style={styles.textoCarregarMais}>Carregar mais despesas</Text>}
            </TouchableOpacity>
          )
        )}

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
  botaoCarregarMais: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2, marginBottom: 10 },
  textoCarregarMais: { color: CORES.accentDark, fontSize: 13, fontWeight: "700" },
  erroInline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#FCE8E6", padding: 12, borderRadius: 10, marginBottom: 12 },
  erroPaginacao: { alignItems: "center", backgroundColor: "#FCE8E6", paddingHorizontal: 12, borderRadius: 10, marginBottom: 10 },
  erroTexto: { flex: 1, color: "#A72F2F", fontSize: 12, textAlign: "center" },
  erroAcao: { color: "#A72F2F", fontSize: 12, fontWeight: "700" },
  estado: { paddingTop: 60, alignItems: "center" }, estadoErro: { paddingTop: 48, paddingHorizontal: 25, alignItems: "center" }, botaoTentarNovamente: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, marginTop: 12, backgroundColor: "#DDF7EE", borderRadius: 12 }, estadoTexto: { color: CORES.muted, fontSize: 12, marginTop: 12 }, vazio: { paddingTop: 55, paddingHorizontal: 25, alignItems: "center" }, vazioIcone: { fontSize: 36, marginBottom: 12 }, vazioTitulo: { color: CORES.ink, fontSize: 14, fontWeight: "700" }, vazioTexto: { color: CORES.muted, fontSize: 11, textAlign: "center", lineHeight: 17, marginTop: 7 },
  acoesSecundarias: { gap: 10, marginTop: 14 }, acaoSecundaria: { backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center" }, acaoIcone: { fontSize: 19, marginRight: 12 }, acaoTexto: { flex: 1, color: CORES.ink, fontWeight: "700", fontSize: 13 }, seta: { color: CORES.accentDark, fontSize: 24, marginTop: -2 },
  fab: { position: "absolute", right: 20, bottom: 82, width: 54, height: 54, borderRadius: 18, backgroundColor: CORES.accent, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: CORES.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9 }, fabText: { color: CORES.ink, fontSize: 28, fontWeight: "600", marginTop: -2 },
});
