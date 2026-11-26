import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import {
  dashboardApi,
  despesasPessoaisApi,
  gruposApi,
  notificacoesApi,
} from "@/services/api";
import type {
  Dashboard,
  DespesaPessoal,
  Grupo,
  PendenciaDashboard,
  PendenciasDashboard,
} from "@/types/api";
import { useUsuario } from "@/contexts/UsuarioContext";
import { formatDateForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { Feather } from "@expo/vector-icons";
import { CATEGORIAS_PESSOAIS } from "@/constants/financeCategories";
import type { CategoriaOpcao } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";

type Aba = "grupos" | "pessoal";
type DirecaoPendencia = "receber" | "pagar";

type PendenciaAgrupada = {
  pessoaId: number;
  pessoaNome: string;
  pessoaAvatarUrl: string | null;
  total: number;
  totalCentavos: number;
  grupos: PendenciaDashboard[];
};

const vazioDashboard: Dashboard = {
  receber: 0, pagar: 0, total_grupos: 0, total_gasto_grupos: 0,
  total_gasto_pessoal: 0, total_gasto_geral: 0, total_despesas_grupos: 0,
  lembretes_proximos: [],
};

const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();

function agruparPendencias(itens: PendenciaDashboard[]): PendenciaAgrupada[] {
  const porPessoa = new Map<number, PendenciaAgrupada>();

  for (const item of itens) {
    let pessoa = porPessoa.get(item.pessoa_id);
    if (!pessoa) {
      pessoa = {
        pessoaId: item.pessoa_id,
        pessoaNome: item.pessoa_nome,
        pessoaAvatarUrl: item.pessoa_avatar_url ?? null,
        total: 0,
        totalCentavos: 0,
        grupos: [],
      };
      porPessoa.set(item.pessoa_id, pessoa);
    }

    pessoa.totalCentavos += Math.round(Number(item.valor) * 100);
    pessoa.grupos.push(item);
  }

  return Array.from(porPessoa.values())
    .map((pessoa) => ({
      ...pessoa,
      total: pessoa.totalCentavos / 100,
      grupos: [...pessoa.grupos].sort((a, b) =>
        a.grupo_nome.localeCompare(b.grupo_nome, "pt-BR"),
      ),
    }))
    .sort((a, b) =>
      b.totalCentavos - a.totalCentavos
      || a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR"),
    );
}

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
const iconeCategoria = (
  categoria: string | null | undefined,
  categorias: readonly CategoriaOpcao[],
) =>
  (categoria && categorias.find((item) => item.nome === categoria)?.icone)
  || (categoria && iconesCategoria[categoria])
  || "📦";

function textoVencimento(dias: number): string {
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

export default function Home() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const reminderStyles = createReminderStyles(Cores);
  const { usuario, atualizarSaldoTotal } = useUsuario();
  const { categorias: categoriasPessoais } = useCategoriasFinanceiras(
    "pessoal",
    CATEGORIAS_PESSOAIS,
  );
  const [abaSelecionada, setAbaSelecionada] = useState<Aba>("pessoal");
  const [dashboard, setDashboard] = useState<Dashboard>(vazioDashboard);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const telaAtiva = useRef(false);
  const [direcaoPendencias, setDirecaoPendencias] =
    useState<DirecaoPendencia | null>(null);
  const [pendencias, setPendencias] = useState<PendenciasDashboard | null>(null);
  const [carregandoPendencias, setCarregandoPendencias] = useState(false);
  const [erroPendencias, setErroPendencias] = useState<string | null>(null);
  const requisicaoPendencias = useRef(0);

  const carregarPendencias = useCallback(async () => {
    const requisicao = ++requisicaoPendencias.current;
    setCarregandoPendencias(true);
    setErroPendencias(null);

    try {
      const resposta = await dashboardApi.pendencias();
      if (requisicao === requisicaoPendencias.current) {
        setPendencias(resposta.data);
      }
    } catch (erro) {
      if (requisicao === requisicaoPendencias.current) {
        setErroPendencias(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar as pendências.",
        );
      }
    } finally {
      if (requisicao === requisicaoPendencias.current) {
        setCarregandoPendencias(false);
      }
    }
  }, []);

  function abrirPendencias(direcao: DirecaoPendencia) {
    setDirecaoPendencias(direcao);
    setPendencias(null);
    void carregarPendencias();
  }

  function fecharPendencias() {
    requisicaoPendencias.current += 1;
    setDirecaoPendencias(null);
    setCarregandoPendencias(false);
  }

  const carregar = useCallback(async () => {
    if (!telaAtiva.current) return;
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const notificacoesPendentes = notificacoesApi
        .listar(true, { limit: 1, offset: 0 })
        .catch((erro: unknown) => {
          console.warn("Não foi possível carregar o contador de notificações.", erro);
          return null;
        });
      const [resumo, gruposResposta, despesasResposta, notificacoesResposta] = await Promise.all([
        dashboardApi.obter(),
        gruposApi.listar({ limit: 3, offset: 0 }),
        despesasPessoaisApi.listar({ tipo: "despesa", limit: 3, offset: 0 }),
        notificacoesPendentes,
      ]);
      if (!telaAtiva.current) return;
      setDashboard(resumo.data);
      atualizarSaldoTotal(Number(resumo.data.receber) - Number(resumo.data.pagar));
      setGrupos(gruposResposta.data.slice(0, 3));
      setDespesas(despesasResposta.data.slice(0, 3));
      if (notificacoesResposta) {
        setNaoLidas(notificacoesResposta.paginacao.total);
      }
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

  const pessoasPendencias = useMemo(
    () => agruparPendencias(
      direcaoPendencias === "receber"
        ? pendencias?.a_receber ?? []
        : direcaoPendencias === "pagar"
          ? pendencias?.a_pagar ?? []
          : [],
    ),
    [direcaoPendencias, pendencias],
  );
  const totalPendenciasDashboard = direcaoPendencias === "receber"
    ? dashboard.receber
    : dashboard.pagar;
  const totalPendenciasDetalhadas = pessoasPendencias.reduce(
    (total, pessoa) => total + pessoa.totalCentavos,
    0,
  ) / 100;
  const totalPendenciasModal = pendencias
    ? totalPendenciasDetalhadas
    : totalPendenciasDashboard;

  if (!usuario) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.hello}>Olá,</Text><Text style={styles.userName}>{usuario.nome}</Text></View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                naoLidas > 0
                  ? `Abrir notificações, ${naoLidas} não lidas`
                  : "Abrir notificações"
              }
              style={styles.notificationButton}
              onPress={() => router.push("/(main)/notificacoes")}
            >
              <Feather name="bell" size={22} color={Cores.texto} />
              {naoLidas > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    backgroundColor: Cores.superficieNotificacao,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: Cores.textoSobreMarca, fontSize: 10, fontWeight: "800" }}>
                    {naoLidas > 99 ? "99+" : naoLidas}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
              style={styles.avatar}
              onPress={() => router.push("/(main)/gerenciamento-perfil")}
            >
              {usuario.avatarUrl ? (
                <Image
                  accessibilityLabel="Foto de perfil"
                  source={{ uri: usuario.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{usuario.iniciais}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Gasto total</Text>
          <Text style={styles.balanceValue}>{formatCurrencyBRL(dashboard.total_gasto_geral)}</Text>
          <View style={styles.balanceIndicators}>
            <TouchableOpacity
              testID="receivables-pill"
              accessibilityRole="button"
              accessibilityLabel={`Ver quem deve a você, ${formatCurrencyBRL(dashboard.receber)} a receber`}
              hitSlop={8}
              onPress={() => abrirPendencias("receber")}
              activeOpacity={0.8}
            >
              <Text style={styles.positivePill}>
                ↑ {formatCurrencyBRL(dashboard.receber)} a receber
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="payables-pill"
              accessibilityRole="button"
              accessibilityLabel={`Ver a quem você deve, ${formatCurrencyBRL(dashboard.pagar)} a pagar`}
              hitSlop={8}
              onPress={() => abrirPendencias("pagar")}
              activeOpacity={0.8}
            >
              <Text style={styles.negativePill}>
                ↓ {formatCurrencyBRL(dashboard.pagar)} a pagar
              </Text>
            </TouchableOpacity>
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

        {carregando ? <ActivityIndicator color={Cores.principal} style={{ marginTop: 48 }} /> : erroCarregamento ? (
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
                <View style={styles.groupAvatar}>
                  {grupo.icone ? (
                    <IconeCategoria icone={grupo.icone} tamanho={24} />
                  ) : (
                    <Text style={styles.groupAvatarText}>{iniciais(grupo.nome)}</Text>
                  )}
                </View>
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
                <View style={styles.personalAvatar}><IconeCategoria icone={iconeCategoria(despesa.categoria, categoriasPessoais)} tamanho={23} /></View>
                <View style={styles.cardInfo}><Text style={styles.cardTitle}>{despesa.descricao}</Text><Text style={styles.cardMeta}>{despesa.categoria || "Outros"} · {formatDateForDisplay(despesa.data_despesa, { day: "2-digit", month: "short" })}</Text></View><Text style={styles.value}>{formatCurrencyBRL(despesa.valor)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push("/(main)/personal/despesas-pessoais")}><Text style={styles.link}>Ver todas as despesas</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={direcaoPendencias !== null}
        transparent
        animationType="slide"
        onRequestClose={fecharPendencias}
      >
        <View style={styles.pendenciasOverlay}>
          <TouchableOpacity
            style={styles.pendenciasBackdrop}
            onPress={fecharPendencias}
            activeOpacity={1}
            accessibilityLabel="Fechar pendências"
          />
          <View style={styles.pendenciasSheet}>
            <View style={styles.pendenciasHandle} />
            <View style={styles.pendenciasHeader}>
              <View style={styles.pendenciasHeaderCopy}>
                <Text style={styles.pendenciasTitle}>
                  {direcaoPendencias === "receber" ? "A receber" : "A pagar"}
                </Text>
                <Text style={styles.pendenciasSubtitle}>
                  {direcaoPendencias === "receber"
                    ? "Quem deve a você"
                    : "A quem você deve"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={fecharPendencias}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Fechar lista de pendências"
              >
                <Text style={styles.pendenciasFechar}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.pendenciasResumo,
                direcaoPendencias === "receber"
                  ? styles.pendenciasResumoReceber
                  : styles.pendenciasResumoPagar,
              ]}
            >
              <View style={styles.pendenciasResumoEtiquetaLinha}>
                <View
                  style={[
                    styles.pendenciasResumoIcone,
                    direcaoPendencias === "receber"
                      ? styles.pendenciasResumoIconeReceber
                      : styles.pendenciasResumoIconePagar,
                  ]}
                >
                  <Feather
                    name={direcaoPendencias === "receber" ? "arrow-down-left" : "arrow-up-right"}
                    size={16}
                    color={
                      direcaoPendencias === "receber"
                        ? Cores.textoPositivo
                        : Cores.textoNegativo
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.pendenciasResumoEtiqueta,
                    direcaoPendencias === "receber"
                      ? styles.pendenciasTotalReceber
                      : styles.pendenciasTotalPagar,
                  ]}
                >
                  {direcaoPendencias === "receber"
                    ? "Total a receber"
                    : "Total a pagar"}
                </Text>
              </View>
              <Text
                style={[
                  styles.pendenciasTotal,
                  direcaoPendencias === "receber"
                    ? styles.pendenciasTotalReceber
                    : styles.pendenciasTotalPagar,
                ]}
              >
                {formatCurrencyBRL(totalPendenciasModal)}
              </Text>
            </View>

            {carregandoPendencias ? (
              <ActivityIndicator
                color={Cores.principal}
                style={styles.pendenciasLoading}
              />
            ) : erroPendencias ? (
              <View style={styles.pendenciasEstado}>
                <Text style={styles.pendenciasMensagem}>
                  Não foi possível carregar os detalhes.
                </Text>
                <Text style={styles.pendenciasErro}>{erroPendencias}</Text>
                <TouchableOpacity
                  style={styles.pendenciasTentarNovamente}
                  onPress={() => void carregarPendencias()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pendenciasTentarNovamenteTexto}>
                    Tentar novamente
                  </Text>
                </TouchableOpacity>
              </View>
            ) : pessoasPendencias.length === 0 ? (
              <View style={styles.pendenciasVazio}>
                <View
                  style={[
                    styles.pendenciasVazioIcone,
                    styles.pendenciasResumoIconeReceber,
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={22}
                    color={Cores.textoPositivo}
                  />
                </View>
                <Text style={styles.pendenciasVazioTitulo}>
                  {direcaoPendencias === "receber"
                    ? "Nada a receber"
                    : "Nada a pagar"}
                </Text>
                <Text style={styles.pendenciasVazias}>
                  {direcaoPendencias === "receber"
                    ? "Nenhum valor pendente no momento."
                    : "Você está em dia com seus pagamentos."}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.pendenciasLista}
                contentContainerStyle={styles.pendenciasListaConteudo}
                showsVerticalScrollIndicator={false}
              >
                {pessoasPendencias.map((pessoa) => (
                  <View
                    key={pessoa.pessoaId}
                    style={styles.pendenciaPessoa}
                  >
                    <View style={styles.pendenciaAvatar}>
                      {pessoa.pessoaAvatarUrl ? (
                        <Image
                          accessibilityLabel={`Foto de ${pessoa.pessoaNome}`}
                          source={{ uri: pessoa.pessoaAvatarUrl }}
                          style={styles.pendenciaAvatarImagem}
                        />
                      ) : (
                        <Text style={styles.pendenciaAvatarTexto}>
                          {iniciais(pessoa.pessoaNome) || "?"}
                        </Text>
                      )}
                    </View>
                    <View style={styles.pendenciaDados}>
                      <Text style={styles.pendenciaNome}>
                        {pessoa.pessoaNome}
                      </Text>
                      {pessoa.grupos.map((grupo) => (
                        <View
                          key={`${grupo.grupo_id}-${grupo.pessoa_id}`}
                          style={styles.pendenciaGrupo}
                        >
                          <Text
                            accessible={false}
                            style={styles.pendenciaGrupoTextoAcessivel}
                          >
                            {grupo.grupo_nome} · {formatCurrencyBRL(Number(grupo.valor))}
                          </Text>
                          <Text style={styles.pendenciaGrupoNome} numberOfLines={1}>
                            {grupo.grupo_nome}
                          </Text>
                          {pessoa.grupos.length > 1 && (
                            <>
                              <Text style={styles.pendenciaGrupoSeparador}> · </Text>
                              <Text style={styles.pendenciaGrupoValor} numberOfLines={1}>
                                {formatCurrencyBRL(Number(grupo.valor))}
                              </Text>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                    <Text
                      style={[
                        styles.pendenciaTotal,
                        direcaoPendencias === "receber"
                          ? styles.pendenciasTotalReceber
                          : styles.pendenciasTotalPagar,
                      ]}
                    >
                      {formatCurrencyBRL(pessoa.total)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => router.push(abaSelecionada === "pessoal" ? "/(main)/personal/despesas-pessoais" : "/(main)/group")}><Text style={styles.fabText}>+</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo }, scroll: { padding: 18, paddingBottom: 90 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 10 }, notificationButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: Cores.borda, backgroundColor: Cores.cartaoFundo, alignItems: "center", justifyContent: "center" }, hello: { color: Cores.textoSuave, fontSize: 12 }, userName: { color: Cores.texto, fontSize: 20, fontWeight: "700" }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Cores.superficieMarca, alignItems: "center", justifyContent: "center" }, avatarImage: { width: 42, height: 42, borderRadius: 21 }, avatarText: { color: Cores.textoSobreMarca, fontWeight: "700" },
  balanceCard: { marginTop: 25, backgroundColor: Cores.superficieMarca, padding: 22, borderRadius: 22 },
  balanceLabel: { color: Cores.textoSuaveSobreMarca, fontSize: 13 }, balanceValue: { color: Cores.textoSobreMarca, fontSize: 29, fontWeight: "700", marginTop: 6 },
  balanceIndicators: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  positivePill: { backgroundColor: Cores.superficiePositiva, color: Cores.textoPositivo, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" },
  negativePill: { backgroundColor: Cores.superficieNegativa, color: Cores.textoNegativo, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, fontSize: 11, fontWeight: "700" },
  segmentContainer: { marginTop: 16, flexDirection: "row", backgroundColor: Cores.superficieMintSuave, borderRadius: 12, padding: 3 }, segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 }, segmentActive: { backgroundColor: Cores.superficieMarca }, segmentText: { color: Cores.textoSuave, fontWeight: "600" }, segmentTextActive: { color: Cores.textoSobreMarca }, content: { marginTop: 22 }, titleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }, sectionTitle: { color: Cores.texto, fontWeight: "700", fontSize: 16 }, count: { color: Cores.textoSuave, fontWeight: "700" }, card: { minHeight: 68, borderWidth: 1, borderColor: Cores.borda, backgroundColor: Cores.cartaoFundo, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 10 }, groupAvatar: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, personalAvatar: { width: 42, height: 42, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" }, categoryEmoji: { fontSize: 23, lineHeight: 28, textAlign: "center" }, groupAvatarText: { color: Cores.textoSobrePrincipal, fontWeight: "800" }, cardInfo: { flex: 1, marginLeft: 10 }, cardTitle: { color: Cores.texto, fontWeight: "700" }, cardMeta: { color: Cores.textoSuave, fontSize: 11, marginTop: 3 }, value: { color: Cores.texto, fontWeight: "700", fontSize: 12 }, arrow: { color: Cores.textoSuave, fontSize: 25 }, empty: { color: Cores.textoSuave, textAlign: "center", paddingVertical: 28 }, link: { color: Cores.textoPositivo, fontWeight: "700", textAlign: "center", padding: 12 }, fab: { position: "absolute", right: 20, bottom: 20, width: 54, height: 54, borderRadius: 18, backgroundColor: Cores.principal, alignItems: "center", justifyContent: "center", elevation: 6 }, fabText: { color: Cores.textoSobrePrincipal, fontSize: 28 },
  loadError: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 },
  errorMessage: { color: Cores.textoSuave, textAlign: "center", marginTop: 8 },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: Cores.superficieVerdeSelecionada },
  retryText: { color: Cores.textoSucesso, fontWeight: "700" },
  pendenciasOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.45)" },
  pendenciasBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  pendenciasSheet: { width: "100%", maxHeight: "82%", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: Cores.cartaoFundo, borderTopWidth: 1, borderTopColor: Cores.bordaSuave },
  pendenciasHandle: { width: 40, height: 4, alignSelf: "center", borderRadius: 2, backgroundColor: Cores.borda, marginBottom: 14 },
  pendenciasHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pendenciasHeaderCopy: { flex: 1 },
  pendenciasTitle: { color: Cores.texto, fontSize: 18, fontWeight: "700" },
  pendenciasSubtitle: { color: Cores.textoSuave, fontSize: 12, marginTop: 3 },
  pendenciasFechar: { color: Cores.textoPositivo, fontSize: 13, fontWeight: "700", padding: 8 },
  pendenciasResumo: { marginTop: 14, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pendenciasResumoReceber: { backgroundColor: Cores.superficieVerde, borderColor: Cores.bordaDestaque },
  pendenciasResumoPagar: { backgroundColor: Cores.superficieNegativa, borderColor: Cores.bordaNegativoSuave },
  pendenciasResumoEtiquetaLinha: { flexDirection: "row", alignItems: "center" },
  pendenciasResumoIcone: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8 },
  pendenciasResumoIconeReceber: { backgroundColor: Cores.superficieVerdeSelecionada },
  pendenciasResumoIconePagar: { backgroundColor: Cores.superficieErro },
  pendenciasResumoEtiqueta: { fontSize: 12, fontWeight: "700" },
  pendenciasTotal: { fontSize: 26, lineHeight: 32, fontWeight: "600", marginTop: 8 },
  pendenciasTotalReceber: { color: Cores.textoPositivo },
  pendenciasTotalPagar: { color: Cores.textoNegativo },
  pendenciasLoading: { paddingVertical: 38 },
  pendenciasEstado: { alignItems: "center", paddingVertical: 24 },
  pendenciasMensagem: { color: Cores.texto, fontWeight: "700", textAlign: "center" },
  pendenciasErro: { color: Cores.textoSuave, fontSize: 12, textAlign: "center", marginTop: 6 },
  pendenciasTentarNovamente: { marginTop: 12, padding: 10 },
  pendenciasTentarNovamenteTexto: { color: Cores.textoPositivo, fontWeight: "700" },
  pendenciasVazio: { alignItems: "center", paddingVertical: 28 },
  pendenciasVazioIcone: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  pendenciasVazioTitulo: { color: Cores.texto, fontSize: 15, fontWeight: "700" },
  pendenciasVazias: { color: Cores.textoSuave, textAlign: "center", marginTop: 5 },
  pendenciasLista: { flexShrink: 1, marginTop: 10 },
  pendenciasListaConteudo: { paddingBottom: 8 },
  pendenciaPessoa: { flexDirection: "row", alignItems: "flex-start", minHeight: 68, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Cores.borda, borderRadius: 14, backgroundColor: Cores.cartaoFundo },
  pendenciaAvatar: { width: 38, height: 38, borderRadius: 12, overflow: "hidden", backgroundColor: Cores.superficieMarca, alignItems: "center", justifyContent: "center" },
  pendenciaAvatarImagem: { width: 38, height: 38 },
  pendenciaAvatarTexto: { color: Cores.textoSobreMarca, fontSize: 12, fontWeight: "800" },
  pendenciaDados: { flex: 1, marginLeft: 10 },
  pendenciaNome: { color: Cores.texto, fontSize: 13, fontWeight: "700" },
  pendenciaGrupo: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  pendenciaGrupoTextoAcessivel: { position: "absolute", width: 1, height: 1, opacity: 0 },
  pendenciaGrupoNome: { flex: 1, color: Cores.textoSuave, fontSize: 11, lineHeight: 16 },
  pendenciaGrupoSeparador: { color: Cores.textoSuave, fontSize: 11 },
  pendenciaGrupoValor: { color: Cores.texto, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  pendenciaTotal: { fontSize: 12, fontWeight: "700", marginLeft: 8 },
});

const createReminderStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  remindersSection: { marginTop: 18 },
  remindersTitle: { color: Cores.texto, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  reminderCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.cartaoFundo,
  },
  reminderInfo: { flex: 1, marginRight: 8 },
  reminderDescription: { color: Cores.texto, fontSize: 13, fontWeight: "700" },
  reminderMeta: { color: Cores.textoSuave, fontSize: 11, marginTop: 4 },
  reminderAmount: { alignItems: "flex-end" },
  reminderPay: { color: Cores.textoNegativo, fontSize: 10, fontWeight: "700" },
  reminderReceive: { color: Cores.textoPositivo, fontSize: 10, fontWeight: "700" },
  reminderValue: { color: Cores.texto, fontSize: 12, fontWeight: "700", marginTop: 3 },
});
