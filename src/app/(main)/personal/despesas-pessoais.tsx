
import React, { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useFocusEffect } from "expo-router";

import {
  despesasPessoaisApi,
  DespesaPessoal,
} from "@/services/api";
import type { PaginacaoLista } from "@/types/api";
import { formatCurrencyBRL } from "@/utils/financeFormat";

// Identidade visual oficial do WEPAY
const CORES = {
  paper: "#F5FBF7",
  ink: "#0B3B33",
  inkSoft: "#12483F",
  surface: "#FFFFFF",
  accent: "#00C896",
  accentDark: "#00A17A",
  coral: "#FF6B5C",
  muted: "#6B8F86",
  line: "#E1EEE8",
  field: "#F0F8F4",
};

// Ícones das categorias
const ICONES: Record<string, string> = {
  Alimentação: "🛒",
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

// Cores utilizadas na composição da barra
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
  Outros: "#A6BDB5",
};

const TAMANHO_PAGINA = 50;

function iconeCategoria(categoria: string | null) {
  return categoria
    ? ICONES[categoria] ?? "📦"
    : "📦";
}

function dataValida(ano: number, mes: number, dia: number) {
  if (ano < 1 || mes < 1 || mes > 12) return false;

  const diasNoMes = [
    31,
    ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return dia >= 1 && dia <= diasNoMes[mes - 1];
}

function formatarRegistro(criadoEm: string | null | undefined) {
  const timestamp = criadoEm?.trim();
  if (!timestamp) return "";

  const partesSemFuso = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
  );

  if (partesSemFuso) {
    const [, anoTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto] =
      partesSemFuso;
    const ano = Number(anoTexto);
    const mes = Number(mesTexto);
    const dia = Number(diaTexto);
    const hora = Number(horaTexto);
    const minuto = Number(minutoTexto);
    const segundo = Number(segundoTexto ?? 0);

    if (
      !dataValida(ano, mes, dia) ||
      hora > 23 ||
      minuto > 59 ||
      segundo > 59
    ) {
      return "";
    }

    return `${diaTexto}/${mesTexto}/${anoTexto.slice(-2)} ${horaTexto}:${minutoTexto}`;
  }

  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return "";

  const normalizado = timestamp
    .replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const data = new Date(normalizado);

  if (Number.isNaN(data.getTime())) return "";

  const dataLocal = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(data);
  const horarioLocal = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);

  return `${dataLocal} ${horarioLocal}`;
}

function obterMesAtual() {
  return new Date().toLocaleDateString("pt-BR", {
    month: "long",
  });
}

export default function DespesasPessoais() {
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [totalMes, setTotalMes] = useState(0);
  const [paginacao, setPaginacao] = useState<PaginacaoLista | null>(null);
  const [categoriasResumo, setCategoriasResumo] = useState<
    { categoria: string | null; valor: number }[]
  >([]);
  const [modalVisivel, setModalVisivel] = useState(false);

  // Carrega os dados reais da API
  const carregarDados = useCallback(async (mostrarLoading = true) => {
    if (mostrarLoading) {
      setCarregando(true);
    } else {
      setAtualizando(true);
    }

    try {
      const [listagem, resumo] = await Promise.all([
        despesasPessoaisApi.listar({
          tipo: "despesa",
          limit: TAMANHO_PAGINA,
          offset: 0,
        }),

        despesasPessoaisApi.totalMes(),
      ]);

      setDespesas(listagem.data);
      setPaginacao(listagem.paginacao);
      setCategoriasResumo(listagem.paginacao.categorias);

      setTotalMes(
        Number(resumo.data.total_despesas ?? 0)
      );
    } catch (e) {
      Alert.alert(
        "Erro",
        e instanceof Error
          ? e.message
          : "Não foi possível carregar suas despesas."
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  const carregarMais = useCallback(async () => {
    if (!paginacao?.has_more || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const resposta = await despesasPessoaisApi.listar({
        tipo: "despesa",
        limit: TAMANHO_PAGINA,
        offset: despesas.length,
      });
      setDespesas((atuais) => [...atuais, ...resposta.data]);
      setPaginacao(resposta.paginacao);
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar mais despesas."
      );
    } finally {
      setCarregandoMais(false);
    }
  }, [carregandoMais, despesas.length, paginacao]);

  // Atualiza sempre que a tela receber foco
  useFocusEffect(
    useCallback(() => {
      carregarDados();

      return undefined;
    }, [carregarDados])
  );

  // Agrupa as despesas reais por categoria
  const resumoCategorias = useMemo(
    () =>
      categoriasResumo
        .filter((item) => Number(item.valor) > 0)
        .map((item) => {
          const categoria = item.categoria ?? "Outros";
          return {
            categoria,
            valor: Number(item.valor),
            cor: CORES_CATEGORIA[categoria] ?? CORES_CATEGORIA.Outros,
          };
        }),
    [categoriasResumo]
  );

  // Soma os valores exibidos para calcular as proporções
  const totalCategorias = resumoCategorias.reduce(
    (total, item) => total + item.valor,
    0
  );

  // Navegação para detalhes
  function abrirDetalhes(id: number | string) {
    router.push({
      pathname: "/(main)/personal/detalhes-despesa-pessoal",
      params: {
        id: String(id),
      },
    });
  }

  // Opção 1: cadastro manual
  function cadastrarManualmente() {
    setModalVisivel(false);

    router.push(
      "/(main)/personal/nova-despesa-pessoal"
    );
  }

  // Opção 2: leitura do recibo com IA
  function lerReciboComIA() {
    setModalVisivel(false);

    router.push(
      "/(main)/receipt-reader/ler-recibo"
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
      />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable
          style={styles.botaoVoltar}
          onPress={() =>
            router.replace("/(main)/home")
          }
          hitSlop={8}
        >
          <Text style={styles.iconeVoltar}>‹</Text>
        </Pressable>

        <View style={styles.headerTextos}>
          <Text style={styles.titulo}>
            Despesas pessoais
          </Text>

          <Text style={styles.subtitulo}>
            Fora dos grupos — só seu controle
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => carregarDados(false)}
            tintColor={CORES.accentDark}
          />
        }
      >
        {/* Resumo financeiro */}
        <View style={styles.cardResumo}>
          <Text style={styles.resumoLabel}>
            Gasto em {obterMesAtual()}
          </Text>

          <Text style={styles.resumoValor}>
            {formatCurrencyBRL(totalMes)}
          </Text>

          {/* Distribuição real das despesas por categoria */}
          {totalCategorias > 0 && (
            <View style={styles.barraCategorias}>
              {resumoCategorias.map((item) => (
                <View
                  key={item.categoria}
                  style={[
                    styles.segmentoCategoria,
                    {
                      flex: item.valor / totalCategorias,
                      backgroundColor: item.cor,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Lista de despesas */}
        {carregando ? (
          <View style={styles.estado}>
            <ActivityIndicator
              size="large"
              color={CORES.accentDark}
            />

            <Text style={styles.estadoTexto}>
              Carregando despesas...
            </Text>
          </View>
        ) : despesas.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioIcone}>🧾</Text>

            <Text style={styles.vazioTitulo}>
              Nenhuma despesa registrada
            </Text>

            <Text style={styles.vazioTexto}>
              Suas despesas pessoais aparecerão aqui.
              Toque no botão + para adicionar uma nova.
            </Text>
          </View>
        ) : (
          <View style={styles.listaDespesas}>
            {despesas.map((despesa) => {
              const registro = formatarRegistro(despesa.criado_em);

              return (
                <Pressable
                  key={despesa.id}
                  style={({ pressed }) => [
                    styles.cardDespesa,
                    pressed && styles.cardDespesaPressionado,
                  ]}
                  onPress={() =>
                    abrirDetalhes(despesa.id)
                  }
                >
                  <View style={styles.iconeDespesa}>
                    <Text
                      style={styles.iconeDespesaEmoji}
                      accessible={false}
                    >
                      {iconeCategoria(despesa.categoria)}
                    </Text>
                  </View>

                  <View style={styles.cardDespesaConteudo}>
                    <Text
                      style={styles.despesaTitulo}
                      numberOfLines={1}
                    >
                      {despesa.descricao}
                    </Text>

                    <Text
                      style={styles.despesaInfo}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {despesa.categoria ?? "Outros"}
                      {registro ? ` · ${registro}` : ""}
                    </Text>
                  </View>

                  <Text style={styles.despesaValor} numberOfLines={1}>
                    {formatCurrencyBRL(Number(despesa.valor))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {!carregando && paginacao?.has_more && (
          <Pressable
            style={styles.botaoCarregarMais}
            onPress={() => void carregarMais()}
            disabled={carregandoMais}
            accessibilityRole="button"
          >
            {carregandoMais ? (
              <ActivityIndicator color={CORES.accentDark} />
            ) : (
              <Text style={styles.textoCarregarMais}>Carregar mais despesas</Text>
            )}
          </Pressable>
        )}

        {atualizando && (
          <ActivityIndicator
            color={CORES.accentDark}
            style={{ marginVertical: 12 }}
          />
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Botão flutuante (+) */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressionado,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Adicionar despesa"
        onPress={() =>
          router.push("/(main)/personal/nova-despesa-pessoal")
        }
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Modal de opções de cadastro */}
      <Modal
        visible={modalVisivel}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.modalContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisivel(false)}
          />

          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitulo}>
              Nova despesa
            </Text>

            <Text style={styles.sheetSubtitulo}>
              Como deseja registrar sua despesa?
            </Text>

            {/* Cadastro manual */}
            <Pressable
              style={styles.opcao}
              onPress={cadastrarManualmente}
            >
              <View style={styles.opcaoIcone}>
                <Text style={styles.opcaoEmoji}>
                  ✍️
                </Text>
              </View>

              <View style={styles.opcaoTextos}>
                <Text style={styles.opcaoTitulo}>
                  Cadastrar manualmente
                </Text>

                <Text style={styles.opcaoDescricao}>
                  Preencha os dados da despesa.
                </Text>
              </View>

              <Text style={styles.opcaoSeta}>›</Text>
            </Pressable>

            {/* Leitura com inteligência artificial */}
            <Pressable
              style={styles.opcao}
              onPress={lerReciboComIA}
            >
              <View style={styles.opcaoIcone}>
                <Text style={styles.opcaoEmoji}>
                  📷
                </Text>
              </View>

              <View style={styles.opcaoTextos}>
                <Text style={styles.opcaoTitulo}>
                  Ler recibo com IA
                </Text>

                <Text style={styles.opcaoDescricao}>
                  Fotografe ou selecione uma imagem.
                </Text>
              </View>

              <Text style={styles.opcaoSeta}>›</Text>
            </Pressable>

            <Pressable
              style={styles.botaoCancelar}
              onPress={() => setModalVisivel(false)}
            >
              <Text style={styles.textoCancelar}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CORES.paper,
  },

  // Cabeçalho
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },

  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: CORES.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: CORES.line,
  },

  iconeVoltar: {
    fontSize: 32,
    color: CORES.ink,
    lineHeight: 34,
    marginTop: -3,
  },

  headerTextos: {
    flex: 1,
  },

  titulo: {
    fontSize: 23,
    fontWeight: "700",
    color: CORES.ink,
  },

  subtitulo: {
    fontSize: 12,
    color: CORES.muted,
    marginTop: 4,
  },

  // Conteúdo
  scroll: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Resumo financeiro
  cardResumo: {
    backgroundColor: CORES.field,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },

  resumoLabel: {
    fontSize: 11,
    color: CORES.muted,
  },

  resumoValor: {
    marginTop: 5,
    fontSize: 25,
    fontWeight: "600",
    color: CORES.ink,
  },

  barraCategorias: {
    flexDirection: "row",
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
    marginTop: 12,
  },

  segmentoCategoria: {
    height: 6,
    borderRadius: 3,
  },

  // Lista de despesas
  listaDespesas: {
    marginTop: 2,
  },

  cardDespesa: {
    minHeight: 68,
    backgroundColor: CORES.surface,
    borderWidth: 1,
    borderColor: CORES.line,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  cardDespesaPressionado: {
    opacity: 0.75,
  },

  botaoCarregarMais: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 10,
  },

  textoCarregarMais: {
    color: CORES.accentDark,
    fontSize: 13,
    fontWeight: "700",
  },

  cardDespesaConteudo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  despesaTitulo: {
    color: CORES.ink,
    fontSize: 14,
    fontWeight: "700",
  },

  despesaValor: {
    flexShrink: 0,
    color: CORES.ink,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },

  despesaInfo: {
    color: CORES.muted,
    fontSize: 11,
    marginTop: 3,
  },

  iconeDespesa: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: CORES.field,
    alignItems: "center",
    justifyContent: "center",
  },

  iconeDespesaEmoji: {
    fontSize: 23,
    lineHeight: 28,
    textAlign: "center",
  },

  // Estados
  estado: {
    paddingTop: 60,
    alignItems: "center",
  },

  estadoTexto: {
    color: CORES.muted,
    fontSize: 12,
    marginTop: 12,
  },

  vazio: {
    paddingTop: 55,
    paddingHorizontal: 25,
    alignItems: "center",
  },

  vazioIcone: {
    fontSize: 36,
    marginBottom: 12,
  },

  vazioTitulo: {
    color: CORES.ink,
    fontSize: 14,
    fontWeight: "700",
  },

  vazioTexto: {
    color: CORES.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 7,
  },

  // Botão flutuante
  fab: {
    position: "absolute",
    right: 20,
    bottom: 82,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: CORES.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: CORES.ink,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 9,
  },

  fabPressionado: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },

  fabText: {
    color: CORES.ink,
    fontSize: 28,
    fontWeight: "600",
    marginTop: -2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,59,51,0.30)",
  },

  bottomSheet: {
    backgroundColor: CORES.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
  },

  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: CORES.line,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 15,
  },

  sheetTitulo: {
    color: CORES.ink,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  sheetSubtitulo: {
    color: CORES.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 13,
  },

  opcao: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CORES.line,
    gap: 10,
  },

  opcaoIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CORES.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  opcaoEmoji: {
    fontSize: 18,
  },

  opcaoTextos: {
    flex: 1,
  },

  opcaoTitulo: {
    color: CORES.ink,
    fontSize: 12,
    fontWeight: "700",
  },

  opcaoDescricao: {
    color: CORES.muted,
    fontSize: 10,
    marginTop: 4,
  },

  opcaoSeta: {
    color: CORES.muted,
    fontSize: 23,
  },

  botaoCancelar: {
    backgroundColor: CORES.field,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },

  textoCancelar: {
    color: CORES.ink,
    fontSize: 12,
    fontWeight: "700",
  },
});
