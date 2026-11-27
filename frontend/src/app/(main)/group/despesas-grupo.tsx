import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
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
import { Feather } from "@expo/vector-icons";
import { IconeCategoria } from "@/components/IconeCategoria";
import { despesasGrupoApi, gruposApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import type { DespesaGrupo, PaginacaoLista } from "@/types/api";
import { formatDateTimeForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import {
  appendUniqueById,
  createPaginationRequestGate,
} from "@/utils/paginationRequestGate";
import { CATEGORIAS_GRUPO } from "@/constants/financeCategories";
import type { CategoriaOpcao } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";

const ICONES_CATEGORIA: Record<string, string> = {
  "Alimentação": "🛒",
  Transporte: "🚕",
  Casa: "🏠",
  Moradia: "🏘️",
  Saúde: "💊",
  Educação: "📚",
  Lazer: "🎮",
  Assinatura: "🎬",
  Assinaturas: "🎬",
  Compras: "🛍️",
  Pets: "🐾",
  Viagem: "✈️",
  Impostos: "🧾",
  Mercado: "🛒",
  "Contas da casa": "💡",
  "Internet e telefone": "📶",
  Limpeza: "🧹",
  "Manutenção e reparos": "🔧",
  Hospedagem: "🏨",
  Passagens: "✈️",
  Combustível: "⛽",
  "Pedágios e estacionamento": "🅿️",
  "Passeios e ingressos": "🎟️",
  Outros: "📦",
};
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

const iconeCategoria = (
  categoria: string | null | undefined,
  categorias: readonly CategoriaOpcao[],
) =>
  (categoria && categorias.find((item) => item.nome === categoria)?.icone)
  || (categoria && ICONES_CATEGORIA[categoria])
  || "📦";
const TAMANHO_PAGINA = 50;

export default function DespesasGrupo() {
  const CORES = useAppTheme();
  const styles = createStyles(CORES);
  const esquema = useAppThemeScheme();
  const { categorias: categoriasFinanceiras } = useCategoriasFinanceiras(
    "grupo",
    CATEGORIAS_GRUPO,
  );
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNomeParam = String(params.grupoNome ?? "Meu grupo");
  const [grupoNome, setGrupoNome] = useState(grupoNomeParam);
  const [podeEditar, setPodeEditar] = useState(false);
  const [erroGrupo, setErroGrupo] = useState<string | null>(null);
  const [excluindoGrupo, setExcluindoGrupo] = useState(false);
  const [filtro, setFiltro] = useState<"Todas" | "Recentes">("Todas");
  const [despesas, setDespesas] = useState<DespesaGrupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [paginacao, setPaginacao] = useState<PaginacaoLista | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [erroCarregamentoMais, setErroCarregamentoMais] = useState<string | null>(null);
  const requestGate = useRef(createPaginationRequestGate());

  const carregarGrupo = useCallback(async () => {
    if (!groupId || Number(groupId) <= 0) return;
    setErroGrupo(null);
    try {
      const resposta = await gruposApi.buscar(Number(groupId));
      setGrupoNome(resposta.data.nome);
      setPodeEditar(resposta.data.pode_editar === true);
    } catch (falha) {
      setPodeEditar(false);
      setErroGrupo(
        falha instanceof Error
          ? falha.message
          : "Não foi possível carregar as permissões do grupo.",
      );
    }
  }, [groupId]);

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
    void carregarGrupo();
    return () => requestGate.current.invalidate();
  }, [carregarDespesas, carregarGrupo]));

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

  async function excluirGrupo() {
    if (excluindoGrupo) return;
    setExcluindoGrupo(true);
    try {
      await gruposApi.deletar(Number(groupId));
      router.replace("/(main)/group");
    } catch (falha) {
      Alert.alert(
        "Erro",
        falha instanceof Error
          ? falha.message
          : "Não foi possível excluir o grupo.",
      );
      setExcluindoGrupo(false);
    }
  }

  function confirmarExclusaoGrupo() {
    if (excluindoGrupo) return;
    const mensagem =
      "A exclusão é permanente e remove as despesas, pagamentos, saldos e participantes do grupo.";

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(mensagem)) {
        void excluirGrupo();
      }
      return;
    }

    Alert.alert("Excluir grupo", mensagem, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir grupo",
        style: "destructive",
        onPress: () => void excluirGrupo(),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}><Text style={styles.iconeVoltar}>‹</Text></TouchableOpacity>
        <View style={styles.headerTextos}><Text style={styles.titulo}>Despesas em grupo</Text><Text style={styles.subtitulo}>{grupoNome}</Text></View>
      </View>
      {erroGrupo && (
        <View style={styles.erroInline} accessibilityRole="alert">
          <Text style={styles.erroTexto}>
            Não foi possível carregar as permissões do grupo: {erroGrupo}
          </Text>
        </View>
      )}

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
                  <View style={styles.despesaTituloLinha}>
                    <IconeCategoria
                      icone={iconeCategoria(categoria, categoriasFinanceiras)}
                      tamanho={16}
                    />
                    <Text style={styles.despesaTitulo} numberOfLines={1}>{item.descricao}</Text>
                  </View>
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
        {podeEditar && (
          <View style={styles.acoesAdmin}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(main)/group/editar",
                  params: { groupId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Editar grupo"
              style={({ pressed }) => [
                styles.botaoEditarGrupo,
                pressed && styles.botaoPressionado,
              ]}
            >
              <Feather
                name="edit-2"
                size={16}
                color={CORES.textoSobrePrincipal}
                accessible={false}
              />
              <Text style={styles.textoBotaoEditar}>Editar grupo</Text>
            </Pressable>
            <Pressable
              onPress={confirmarExclusaoGrupo}
              disabled={excluindoGrupo}
              accessibilityRole="button"
              accessibilityLabel="Excluir grupo"
              style={({ pressed }) => [
                styles.botaoExcluirGrupo,
                (pressed || excluindoGrupo) && styles.botaoPressionado,
              ]}
            >
              {excluindoGrupo ? (
                <ActivityIndicator color={CORES.textoNegativo} />
              ) : (
                <>
                  <Feather
                    name="trash-2"
                    size={16}
                    color={CORES.textoNegativo}
                    accessible={false}
                  />
                  <Text style={styles.textoExcluirGrupo}>Excluir grupo</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={abrirNovaDespesa} accessibilityLabel="Nova despesa"><Text style={styles.fabText}>+</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (CORES: PaletaSemantica) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CORES.paper },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, justifyContent: "center", alignItems: "center", marginRight: 12 },
  iconeVoltar: { fontSize: 32, color: CORES.ink, lineHeight: 34, marginTop: -3 }, headerTextos: { flex: 1 },
  titulo: { fontSize: 23, fontWeight: "700", color: CORES.ink }, subtitulo: { fontSize: 12, color: CORES.muted, marginTop: 4 },
  scroll: { flex: 1 }, conteudo: { paddingHorizontal: 20, paddingBottom: 122 },
  acoesAdmin: { marginTop: 24, gap: 10 },
  botaoEditarGrupo: {
    height: 50,
    backgroundColor: CORES.accentDark,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  textoBotaoEditar: {
    color: CORES.textoSobrePrincipal,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "sans-serif",
  },
  botaoExcluirGrupo: {
    height: 48,
    backgroundColor: CORES.superficieNegativa,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.bordaNegativoSuave,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  textoExcluirGrupo: {
    color: CORES.textoNegativo,
    fontSize: 13,
    fontWeight: "800",
    fontFamily: "sans-serif",
  },
  botaoPressionado: { opacity: 0.75 },
  cardResumo: { backgroundColor: CORES.field, borderRadius: 16, padding: 14, marginBottom: 18 },
  grupoChip: { alignSelf: "flex-start", backgroundColor: CORES.superficieVerdeSelecionada, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 10 }, grupoChipTexto: { color: CORES.ink, fontSize: 10, fontWeight: "700" },
  resumoLabel: { fontSize: 11, color: CORES.muted }, resumoValor: { marginTop: 5, fontSize: 25, fontWeight: "600", color: CORES.ink }, resumoNota: { marginTop: 5, fontSize: 11, color: CORES.muted },
  barraCategorias: { flexDirection: "row", height: 6, borderRadius: 4, overflow: "hidden", gap: 2, marginTop: 12 },
  segmentoCategoria: { height: 6, borderRadius: 3 },
  linhaTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, secaoTitulo: { color: CORES.ink, fontSize: 16, fontWeight: "700" }, quantidade: { minWidth: 22, textAlign: "center", color: CORES.muted, fontSize: 11, fontWeight: "700" },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 8 }, filtro: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line }, filtroAtivo: { backgroundColor: CORES.superficieVerdeSelecionada, borderColor: CORES.accent }, filtroTexto: { color: CORES.muted, fontSize: 11, fontWeight: "600" }, filtroTextoAtivo: { color: CORES.ink },
  listaDespesas: { marginTop: 2 },
  cartaoDespesa: { backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, borderRadius: 14, marginBottom: 10 },
  cartaoDespesaConteudo: { padding: 12 },
  cartaoDespesaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  despesaTituloLinha: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
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
  erroInline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: CORES.superficieErro, padding: 12, borderRadius: 10, marginBottom: 12 },
  erroPaginacao: { alignItems: "center", backgroundColor: CORES.superficieErro, paddingHorizontal: 12, borderRadius: 10, marginBottom: 10 },
  erroTexto: { flex: 1, color: CORES.textoErro, fontSize: 12, textAlign: "center" },
  erroAcao: { color: CORES.textoErro, fontSize: 12, fontWeight: "700" },
  estado: { paddingTop: 60, alignItems: "center" }, estadoErro: { paddingTop: 48, paddingHorizontal: 25, alignItems: "center" }, botaoTentarNovamente: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, marginTop: 12, backgroundColor: CORES.superficieVerdeSelecionada, borderRadius: 12 }, estadoTexto: { color: CORES.muted, fontSize: 12, marginTop: 12 }, vazio: { paddingTop: 55, paddingHorizontal: 25, alignItems: "center" }, vazioIcone: { fontSize: 36, marginBottom: 12 }, vazioTitulo: { color: CORES.ink, fontSize: 14, fontWeight: "700" }, vazioTexto: { color: CORES.muted, fontSize: 11, textAlign: "center", lineHeight: 17, marginTop: 7 },
  acoesSecundarias: { gap: 10, marginTop: 14 }, acaoSecundaria: { backgroundColor: CORES.surface, borderWidth: 1, borderColor: CORES.line, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center" }, acaoIcone: { fontSize: 19, marginRight: 12 }, acaoTexto: { flex: 1, color: CORES.ink, fontWeight: "700", fontSize: 13 }, seta: { color: CORES.accentDark, fontSize: 24, marginTop: -2 },
  fab: { position: "absolute", right: 20, bottom: 82, width: 54, height: 54, borderRadius: 18, backgroundColor: CORES.accent, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: CORES.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9 }, fabText: { color: CORES.textoSobrePrincipal, fontSize: 28, fontWeight: "600", marginTop: -2 },
});
