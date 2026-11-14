
import React from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasPessoaisApi } from "@/services/api";
import { CATEGORIAS_PESSOAIS as CATEGORIAS } from "@/constants/financeCategories";
import type { DespesaPessoal } from "@/types/api";
import { formatDateForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";

const WEPAY = {
  paper: "#F5FBF7",
  ink: "#0B3B33",
  inkSoft: "#315D53",
  accent: "#00C896",
  accentDark: "#00A17A",
  softGreen: "#BFE0D6",
  surface: "#FFFFFF",
  line: "#E1EEE8",
  muted: "#6B8F86",
};

export default function DetalhesDespesaPessoalScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const idNumerico = id ? Number(id) : NaN;
  const [despesa, setDespesa] = React.useState<DespesaPessoal | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let ativo = true;

      async function carregarDespesa() {
        setCarregando(true);
        setErro(null);

        if (!Number.isSafeInteger(idNumerico) || idNumerico <= 0) {
          setErro("O identificador desta despesa é inválido.");
          setCarregando(false);
          return;
        }

        try {
          const resposta = await despesasPessoaisApi.buscar(idNumerico);
          if (ativo) setDespesa(resposta.data);
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
    }, [idNumerico])
  );

  function voltar() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)/personal/despesas-pessoais");
    }
  }

  function editarDespesa() {
    if (!despesa) return;

    router.push({
      pathname: "/(main)/personal/editar-despesa-pessoal",
      params: { id: String(despesa.id) },
    });
  }

  async function excluirDespesaAtual() {
    if (!despesa || excluindo) return;

    setExcluindo(true);
    setErroAcao(null);

    try {
      await despesasPessoaisApi.deletar(despesa.id);
      router.replace("/(main)/personal/despesas-pessoais");
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
      <View style={[styles.container, styles.loading]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator color={WEPAY.accent} />
      </View>
    );
  }

  if (!despesa) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundIcon}>🧾</Text>

        <Text style={styles.notFoundTitle}>
          Despesa não encontrada
        </Text>

        <Text style={styles.notFoundDescription}>
          {erro ?? "Não foi possível localizar as informações deste lançamento."}
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.replace(
              "/(main)/personal/despesas-pessoais"
            )
          }
        >
          <Text style={styles.backButtonText}>
            Voltar para despesas
          </Text>
        </Pressable>
      </View>
    );
  }

  const tipoLabel = despesa.tipo === "receita" ? "Receita pessoal" : "Despesa pessoal";
  const categoria = CATEGORIAS.find(
    (item) => item.nome === despesa.categoria
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable
            onPress={voltar}
            hitSlop={12}
            style={styles.backArea}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Voltar</Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Detalhes da despesa
          </Text>

          <Text style={styles.headerSubtitle}>
            Confira as informações deste lançamento.
          </Text>
        </View>

        {/* Cartão principal */}
        <View style={styles.mainCard}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptIcon}>
              <Text style={styles.receiptEmoji}>
                {categoria?.icone ?? "📌"}
              </Text>
            </View>

            <View style={styles.originBadge}>
              <Text style={styles.originBadgeText}>
                {tipoLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.expenseDescription}>
            {despesa.descricao}
          </Text>

          <Text style={styles.expenseValue}>
            {formatCurrencyBRL(despesa.valor)}
          </Text>

          <View style={styles.mainCardDivider} />

          <View style={styles.mainCardFooter}>
            <Text style={styles.mainCardFooterText}>
              {formatDateForDisplay(despesa.data_despesa, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>

            <Text style={styles.mainCardFooterText}>
              {despesa.categoria ?? "Outros"}
            </Text>
          </View>
        </View>

        {/* Informações da despesa */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Informações da despesa
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Text style={styles.detailIcon}>📝</Text>
              <Text style={styles.detailLabel}>
                Descrição
              </Text>
            </View>

            <Text style={styles.detailValue}>
              {despesa.descricao}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Text style={styles.detailIcon}>💰</Text>
              <Text style={styles.detailLabel}>
                Valor
              </Text>
            </View>

            <Text style={styles.detailValue}>
              {formatCurrencyBRL(despesa.valor)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Text style={styles.detailIcon}>📅</Text>
              <Text style={styles.detailLabel}>
                Data da despesa
              </Text>
            </View>

            <Text style={styles.detailValue}>
              {formatDateForDisplay(despesa.data_despesa, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Text style={styles.detailIcon}>🏷️</Text>
              <Text style={styles.detailLabel}>
                Categoria
              </Text>
            </View>

            <Text style={styles.detailValue}>
              {categoria?.icone ?? "📌"} {despesa.categoria ?? "Outros"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Text style={styles.detailIcon}>📋</Text>
              <Text style={styles.detailLabel}>
                Origem do cadastro
              </Text>
            </View>

            <Text style={styles.detailValue}>
              {despesa.tipo === "receita" ? "Receita" : "Despesa"}
            </Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actions}>
          <Pressable
            onPress={editarDespesa}
            disabled={excluindo}
            style={({ pressed }) => [
              styles.editButton,
              (pressed || excluindo) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.editButtonText}>
              ✎  Editar despesa
            </Text>
          </Pressable>

          <Pressable
            onPress={confirmarExclusao}
            disabled={excluindo}
            style={({ pressed }) => [
              styles.deleteButton,
              (pressed || excluindo) && styles.buttonPressed,
            ]}
          >
            {excluindo ? (
              <ActivityIndicator color="#D24A3B" />
            ) : (
              <Text style={styles.deleteButtonText}>Excluir despesa</Text>
            )}
          </Pressable>
          {erroAcao ? (
            <Text accessibilityRole="alert" style={styles.actionError}>
              {erroAcao}
            </Text>
          ) : null}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WEPAY.paper,
  },

  loading: {
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 22,
  },

  backArea: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  backIcon: {
    color: WEPAY.accentDark,
    fontSize: 29,
    lineHeight: 30,
    marginRight: 5,
  },

  backText: {
    color: WEPAY.accentDark,
    fontSize: 13,
    fontWeight: "600",
  },

  headerTitle: {
    color: WEPAY.ink,
    fontSize: 22,
    fontWeight: "700",
  },

  headerSubtitle: {
    color: WEPAY.muted,
    fontSize: 12,
    marginTop: 5,
  },

  mainCard: {
    backgroundColor: WEPAY.ink,
    borderRadius: 18,
    padding: 20,
    overflow: "hidden",
  },

  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  receiptIcon: {
    width: 48,
    height: 48,
    backgroundColor: WEPAY.accent,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  receiptEmoji: {
    fontSize: 23,
  },

  originBadge: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  originBadgeText: {
    color: WEPAY.softGreen,
    fontSize: 10,
    fontWeight: "600",
  },

  expenseDescription: {
    color: WEPAY.surface,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 20,
  },

  expenseValue: {
    color: WEPAY.accent,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 7,
  },

  mainCardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 17,
  },

  mainCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  mainCardFooterText: {
    color: WEPAY.softGreen,
    fontSize: 11,
    fontWeight: "500",
  },

  sectionHeader: {
    marginTop: 25,
    marginBottom: 12,
  },

  sectionTitle: {
    color: WEPAY.ink,
    fontSize: 15,
    fontWeight: "700",
  },

  detailsCard: {
    backgroundColor: WEPAY.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: WEPAY.line,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 57,
    gap: 8,
  },

  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },

  detailIcon: {
    fontSize: 15,
  },

  detailLabel: {
    color: WEPAY.muted,
    fontSize: 11,
  },

  detailValue: {
    color: WEPAY.ink,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 1,
  },

  divider: {
    height: 1,
    backgroundColor: WEPAY.line,
  },

  observationCard: {
    backgroundColor: WEPAY.surface,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: WEPAY.line,
  },

  observationText: {
    color: WEPAY.inkSoft,
    fontSize: 12,
    lineHeight: 19,
  },

  actions: {
    marginTop: 28,
    gap: 12,
  },

  editButton: {
    height: 50,
    backgroundColor: WEPAY.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: WEPAY.ink,
    fontSize: 13,
    fontWeight: "700",
  },

  deleteButton: {
    height: 48,
    backgroundColor: "#FFE7E2",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: "#D24A3B",
    fontSize: 12,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.75,
  },

  actionError: {
    color: "#D24A3B",
    fontSize: 12,
    textAlign: "center",
  },

  notFound: {
    flex: 1,
    backgroundColor: WEPAY.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  notFoundIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  notFoundTitle: {
    color: WEPAY.ink,
    fontWeight: "700",
    fontSize: 17,
  },

  notFoundDescription: {
    color: WEPAY.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: WEPAY.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },

  backButtonText: {
    color: WEPAY.ink,
    fontWeight: "700",
    fontSize: 12,
  },
});
