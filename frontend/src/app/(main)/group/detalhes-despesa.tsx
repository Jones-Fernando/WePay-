import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";

import React from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { despesasGrupoApi, participantesApi } from "@/services/api";
import { CATEGORIAS_GRUPO as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import type { DespesaGrupo } from "@/types/api";
import { formatDateForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { Alert } from "@/services/feedback";
import { IconeCategoria } from "@/components/IconeCategoria";

const nomesDivisao = {
  igual: "Divisão igual",
  porcentagem: "Por porcentagem",
  valores: "Valores definidos",
} as const;

export default function DetalhesDespesa() {
  const Cores = useAppTheme();
  const esquema = useAppThemeScheme();
  const styles = createStyles(Cores);
  const { categorias } = useCategoriasFinanceiras("grupo", CATEGORIAS);
  const params = useLocalSearchParams<{
    id?: string | string[];
    groupId?: string | string[];
    grupoNome?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const grupoNome = Array.isArray(params.grupoNome) ? params.grupoNome[0] : params.grupoNome;
  const idNumerico = id ? Number(id) : NaN;
  const [despesa, setDespesa] = React.useState<DespesaGrupo | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState(false);
  const [avataresParticipantes, setAvataresParticipantes] = React.useState<Record<string, string>>({});

  const voltarParaLista = React.useCallback(() => {
    router.replace({
      pathname: "/(main)/group/despesas-grupo",
      params: { groupId, grupoNome },
    });
  }, [groupId, grupoNome]);

  useFocusEffect(
    React.useCallback(() => {
      let ativo = true;

      async function carregarDespesa() {
        setCarregando(true);
        setErro(null);
        setAvataresParticipantes({});

        if (!Number.isSafeInteger(idNumerico) || idNumerico <= 0) {
          setErro("O identificador desta despesa é inválido.");
          setCarregando(false);
          return;
        }

        try {
          const resposta = await despesasGrupoApi.buscar(idNumerico);
          if (!ativo) return;
          setDespesa(resposta.data);

          const grupoIdNumerico = Number(groupId);
          if (Number.isSafeInteger(grupoIdNumerico) && grupoIdNumerico > 0) {
            try {
              const participantes = await participantesApi.listarTodos(grupoIdNumerico);
              if (!ativo) return;
              setAvataresParticipantes(
                Object.fromEntries(
                  participantes
                    .filter((participante) => participante.avatar_url)
                    .map((participante) => [
                      String(participante.usuario_id),
                      participante.avatar_url as string,
                    ])
                )
              );
            } catch {
              if (ativo) setAvataresParticipantes({});
            }
          }
        } catch (falha) {
          if (ativo) {
            setDespesa(null);
            setErro(
              falha instanceof Error
                ? falha.message
                : "Não foi possível carregar esta despesa."
            );
          }
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      void carregarDespesa();
      return () => {
        ativo = false;
      };
    }, [idNumerico, groupId])
  );

  function voltar() {
    if (router.canGoBack()) {
      router.back();
    } else {
      voltarParaLista();
    }
  }

  function editar() {
    if (!despesa) return;
    router.push({
      pathname: "/(main)/group/editar-despesa",
      params: { id: String(despesa.id), groupId, grupoNome },
    });
  }

  async function excluirDespesaAtual() {
    if (!despesa || excluindo) return;

    setExcluindo(true);
    setErroAcao(null);

    try {
      await despesasGrupoApi.deletar(despesa.id);
      voltarParaLista();
    } catch (falha) {
      setErroAcao(
        falha instanceof Error
          ? falha.message
          : "Não foi possível excluir esta despesa."
      );
      setExcluindo(false);
    }
  }

  function confirmarExclusao() {
    if (!despesa || excluindo) return;

    const mensagem =
      "Tem certeza de que deseja excluir esta despesa? Essa ação não poderá ser desfeita.";

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(mensagem)) {
        void excluirDespesaAtual();
      }
      return;
    }

    Alert.alert("Excluir despesa", mensagem, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => void excluirDespesaAtual(),
      },
    ]);
  }

  if (carregando) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]}>
        <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
        <ActivityIndicator color={Cores.principal} />
        <Text style={styles.loadingText}>Carregando despesa...</Text>
      </SafeAreaView>
    );
  }

  if (!despesa) {
    return (
      <SafeAreaView style={styles.notFound}>
        <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
        <View style={styles.notFoundIcon}>
          <Feather name="file-text" size={28} color={Cores.textoPositivo} accessible={false} />
        </View>
        <Text style={styles.notFoundTitle}>Despesa não encontrada</Text>
        <Text style={styles.notFoundDescription}>
          {erro ?? "Não foi possível localizar as informações deste lançamento."}
        </Text>
        <Pressable
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar para despesas"
          onPress={voltarParaLista}
        >
          <Text style={styles.backButtonText}>Voltar para despesas</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const divisoes = despesa.divisoes ?? [];
  const valorTotal = Number(despesa.valor);
  const categoria = categorias.find((item) => item.nome === despesa.categoria);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Pressable
            onPress={voltar}
            hitSlop={12}
            style={styles.backArea}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather name="arrow-left" size={20} color={Cores.texto} accessible={false} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Detalhes da despesa</Text>
            <Text style={styles.headerSubtitle}>Confira as informações deste lançamento compartilhado.</Text>
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptIcon}>
              <IconeCategoria icone={categoria?.icone ?? "📦"} tamanho={34} />
            </View>
            <View style={styles.originBadge}>
              <Text style={styles.originBadgeText}>Despesa em grupo</Text>
            </View>
          </View>

          <Text style={styles.expenseDescription}>{despesa.descricao}</Text>
          <Text style={styles.expenseValue}>{formatCurrencyBRL(valorTotal)}</Text>

          <View style={styles.mainCardDivider} />

          <View style={styles.mainCardFooter}>
            <View style={styles.mainCardFooterItem}>
              <IconeCategoria icone="📅" tamanho={18} />
              <Text style={styles.mainCardFooterText}>
                {formatDateForDisplay(despesa.data_despesa, {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>

            <View style={[styles.mainCardFooterItem, styles.mainCardCategory]}>
              <IconeCategoria icone={categoria?.icone ?? "📌"} tamanho={18} />
              <Text style={styles.mainCardFooterText}>
                {despesa.categoria || "Sem categoria"}
              </Text>
            </View>
          </View>
        </View>

        {!!despesa.observacao && (
          <View style={styles.observationCard}>
            <Text style={styles.sectionLabel}>Observação</Text>
            <Text style={styles.observationText}>{despesa.observacao}</Text>
          </View>
        )}

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Participantes ({divisoes.length})</Text>
          {divisoes.length === 0 ? (
            <Text style={styles.emptyParticipants}>Nenhum participante informado.</Text>
          ) : (
            divisoes.map((divisao, indice) => {
              const valorDivisao =
                divisao.tipo === "porcentagem"
                  ? (valorTotal * Number(divisao.percentual ?? 0)) / 100
                  : Number(
                      divisao.valor ??
                        (divisoes.length ? valorTotal / divisoes.length : 0)
                    );
              const isPagador =
                String(divisao.usuario_id) === String(despesa.pagador_id);
              return (
                <View key={divisao.usuario_id}>
                  <View style={styles.participantRow}>
                    <View style={styles.avatar}>
                      {avataresParticipantes[String(divisao.usuario_id)] ? (
                        <Image
                          source={{ uri: avataresParticipantes[String(divisao.usuario_id)] }}
                          style={styles.avatarImage}
                          resizeMode="cover"
                          accessible={false}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(divisao.nome || "?").charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.participantInfo}>
                      <View style={styles.participantNameRow}>
                        <Text style={styles.detailValue}>
                          {divisao.nome || "Participante"}
                        </Text>
                        {isPagador && (
                          <View style={styles.payerBadge}>
                            <Feather
                              name="credit-card"
                              size={11}
                              color={Cores.textoPositivo}
                              accessible={false}
                            />
                            <Text style={styles.payerBadgeText}>Pagador</Text>
                          </View>
                        )}
                      </View>
                      {!isPagador && divisao.tipo !== "igual" && (
                        <Text style={styles.participantDetail}>
                          {divisao.tipo === "porcentagem"
                            ? `${Number(divisao.percentual ?? 0)}%`
                            : nomesDivisao[divisao.tipo]}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.participantValue}>{formatCurrencyBRL(valorDivisao)}</Text>
                  </View>
                  {indice < divisoes.length - 1 && <View style={styles.cardDivider} />}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={editar}
            disabled={excluindo}
            accessibilityRole="button"
            accessibilityLabel="Editar despesa"
            style={({ pressed }) => [
              styles.editButton,
              (pressed || excluindo) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.editButtonText}>✎  Editar despesa</Text>
          </Pressable>

          <Pressable
            onPress={confirmarExclusao}
            disabled={excluindo}
            accessibilityRole="button"
            accessibilityLabel="Excluir despesa"
            style={({ pressed }) => [
              styles.deleteButton,
              (pressed || excluindo) && styles.buttonPressed,
            ]}
          >
            {excluindo ? (
              <ActivityIndicator color={Cores.textoNegativo} />
            ) : (
              <>
                <Feather name="trash-2" size={16} color={Cores.textoNegativo} accessible={false} />
                <Text style={styles.deleteButtonText}>Excluir despesa</Text>
              </>
            )}
          </Pressable>
          {erroAcao ? (
            <Text accessibilityRole="alert" style={styles.actionError}>
              {erroAcao}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Cores.fundo,
    },
    loading: {
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      color: Cores.textoSuave,
      fontSize: 13,
      marginTop: 10,
      fontFamily: "sans-serif",
    },
    scrollContent: {
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 36,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 58,
      marginBottom: 18,
    },
    backArea: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Cores.borda,
      backgroundColor: Cores.cartaoFundo,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      color: Cores.texto,
      fontSize: 20,
      fontWeight: "800",
      fontFamily: "sans-serif",
    },
    headerSubtitle: {
      color: Cores.textoSuave,
      fontSize: 13,
      marginTop: 3,
      fontFamily: "sans-serif",
    },
    mainCard: {
      backgroundColor: Cores.superficieMarca,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Cores.bordaDestaque,
      paddingHorizontal: 20,
      paddingVertical: 18,
      overflow: "hidden",
    },
    receiptHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 34,
    },
    receiptIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    originBadge: {
      backgroundColor: "transparent",
    },
    originBadgeText: {
      color: Cores.textoSobreMarca,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: "sans-serif",
      letterSpacing: 0.2,
      textAlign: "right",
    },
    expenseDescription: {
      color: Cores.textoSobreMarca,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: "sans-serif",
      lineHeight: 26,
      marginTop: 16,
    },
    expenseValue: {
      color: Cores.principal,
      fontSize: 28,
      fontWeight: "700",
      fontFamily: "sans-serif",
      letterSpacing: -0.8,
      marginTop: 6,
    },
    mainCardDivider: {
      height: 1,
      backgroundColor: Cores.bordaDestaque,
      opacity: 0.32,
      marginTop: 18,
      marginBottom: 14,
    },
    mainCardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    mainCardFooterItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    mainCardCategory: {
      justifyContent: "flex-end",
    },
    mainCardFooterText: {
      color: Cores.textoSobreMarca,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      fontFamily: "sans-serif",
      flexShrink: 1,
    },
    observationCard: {
      marginTop: 16,
      backgroundColor: Cores.cartaoFundo,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Cores.borda,
      padding: 16,
    },
    observationText: {
      color: Cores.texto,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 6,
      fontFamily: "sans-serif",
    },
    detailsCard: {
      marginTop: 16,
      backgroundColor: Cores.cartaoFundo,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Cores.borda,
      paddingHorizontal: 18,
      paddingVertical: 17,
    },
    sectionLabel: {
      color: Cores.textoSuave,
      fontSize: 11,
      marginBottom: 3,
      fontWeight: "600",
      fontFamily: "sans-serif",
    },
    detailValue: {
      color: Cores.texto,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "sans-serif",
    },
    cardDivider: {
      height: 1,
      backgroundColor: Cores.superficieBorda,
      marginVertical: 12,
    },
    sectionTitle: {
      color: Cores.texto,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 10,
      fontFamily: "sans-serif",
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 58,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Cores.superficieAvatar,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      overflow: "hidden",
    },
    avatarImage: {
      width: 44,
      height: 44,
    },
    avatarText: {
      color: Cores.texto,
      fontWeight: "800",
      fontFamily: "sans-serif",
    },
    participantInfo: {
      flex: 1,
    },
    participantNameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 7,
    },
    payerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: Cores.superficieVerde,
      borderWidth: 1,
      borderColor: Cores.bordaDestaque,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    payerBadgeText: {
      color: Cores.textoPositivo,
      fontSize: 10,
      fontWeight: "700",
      fontFamily: "sans-serif",
    },
    participantDetail: {
      color: Cores.textoSuave,
      fontSize: 12,
      marginTop: 3,
      fontFamily: "sans-serif",
    },
    participantValue: {
      color: Cores.textoPositivo,
      fontSize: 15,
      fontWeight: "700",
      fontFamily: "sans-serif",
    },
    emptyParticipants: {
      color: Cores.textoSuave,
      fontSize: 13,
      fontFamily: "sans-serif",
    },
    actions: {
      marginTop: 24,
      gap: 10,
    },
    editButton: {
      height: 50,
      backgroundColor: Cores.principalEscuro,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    editButtonText: {
      color: Cores.textoSobrePrincipal,
      fontSize: 14,
      fontWeight: "800",
      fontFamily: "sans-serif",
    },
    deleteButton: {
      height: 48,
      backgroundColor: Cores.superficieNegativa,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Cores.bordaNegativoSuave,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    deleteButtonText: {
      color: Cores.textoNegativo,
      fontSize: 13,
      fontWeight: "800",
      fontFamily: "sans-serif",
    },
    buttonPressed: {
      opacity: 0.75,
    },
    actionError: {
      color: Cores.textoNegativo,
      fontSize: 12,
      textAlign: "center",
      fontFamily: "sans-serif",
    },
    notFound: {
      flex: 1,
      backgroundColor: Cores.fundo,
      alignItems: "center",
      justifyContent: "center",
      padding: 25,
    },
    notFoundIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: Cores.superficieVerde,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    notFoundTitle: {
      color: Cores.texto,
      fontWeight: "800",
      fontSize: 17,
      fontFamily: "sans-serif",
    },
    notFoundDescription: {
      color: Cores.textoSuave,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 20,
      fontFamily: "sans-serif",
    },
    backButton: {
      backgroundColor: Cores.principal,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 13,
    },
    backButtonText: {
      color: Cores.texto,
      fontWeight: "800",
      fontSize: 12,
      fontFamily: "sans-serif",
    },
  });
