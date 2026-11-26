import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";

import React from "react";

import {
  ActivityIndicator,
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
import { despesasPessoaisApi } from "@/services/api";
import { CATEGORIAS_PESSOAIS as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import type { DespesaPessoal } from "@/types/api";
import { formatDateForDisplay } from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { Alert } from "@/services/feedback";
import { IconeCategoria } from "@/components/IconeCategoria";

export default function DetalhesDespesaPessoalScreen() {
  const Cores = useAppTheme();
  const esquema = useAppThemeScheme();
  const styles = createStyles(Cores);
  const { categorias } = useCategoriasFinanceiras("pessoal", CATEGORIAS);
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
      <SafeAreaView style={[styles.container, styles.loading]}>
        <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
        <ActivityIndicator color={Cores.principal} />
      </SafeAreaView>
    );
  }

  if (!despesa) {
    return (
      <SafeAreaView style={styles.notFound}>
        <View style={styles.notFoundIcon}>
          <Feather name="file-text" size={28} color={Cores.textoPositivo} accessible={false} />
        </View>

        <Text style={styles.notFoundTitle}>
          Despesa não encontrada
        </Text>

        <Text style={styles.notFoundDescription}>
          {erro ?? "Não foi possível localizar as informações deste lançamento."}
        </Text>

        <Pressable
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar para despesas"
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
      </SafeAreaView>
    );
  }

  const tipoLabel = despesa.tipo === "receita" ? "Receita pessoal" : "Despesa pessoal";
  const categoria = categorias.find(
    (item) => item.nome === despesa.categoria
  );

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
            <Text style={styles.headerTitle}>
              Detalhes do lançamento
            </Text>

            <Text style={styles.headerSubtitle}>
              Confira as informações deste registro.
            </Text>
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptIcon}>
              <IconeCategoria icone={categoria?.icone ?? "Outros"} tamanho={34} />
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
                {despesa.categoria ?? "Outros"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={editarDespesa}
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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  loading: {
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "700",
    fontSize: 17,
  },

  notFoundDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: Cores.principal,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },

  backButtonText: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 12,
  },
});
