import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { notificacoesApi } from "@/services/api";
import type { Notificacao, Paginacao } from "@/types/api";
import { formatDateTimeForDisplay } from "@/utils/financeInput";
import {
  appendUniqueById,
  createPaginationRequestGate,
} from "@/utils/paginationRequestGate";

export default function NotificacoesScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null);
  const gate = useRef(createPaginationRequestGate()).current;

  const carregar = useCallback(async () => {
    gate.activate();
    const generation = gate.beginFirstPage();
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await notificacoesApi.listar(false, { limit: 50, offset: 0 });
      if (!gate.isCurrent(generation)) return;
      setNotificacoes(resposta.data);
      setPaginacao(resposta.paginacao);
    } catch (falha) {
      if (gate.isCurrent(generation)) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as notificações.");
      }
    } finally {
      gate.finishFirstPage(generation);
      if (gate.isCurrent(generation)) setCarregando(false);
    }
  }, [gate]);

  const carregarMais = useCallback(async () => {
    if (!paginacao?.has_more) return;
    const ticket = gate.beginNextPage();
    if (!ticket) return;
    setCarregandoMais(true);
    try {
      const resposta = await notificacoesApi.listar(false, {
        limit: paginacao.limit,
        offset: paginacao.offset + paginacao.limit,
      });
      if (!gate.isCurrentPage(ticket)) return;
      setNotificacoes((atuais) => appendUniqueById(atuais, resposta.data));
      setPaginacao(resposta.paginacao);
    } catch (falha) {
      if (gate.isCurrentPage(ticket)) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar mais notificações.");
      }
    } finally {
      gate.finishNextPage(ticket);
      if (gate.isCurrent(ticket.generation)) setCarregandoMais(false);
    }
  }, [gate, paginacao]);

  useFocusEffect(useCallback(() => {
    gate.activate();
    void carregar();
    return () => gate.invalidate();
  }, [carregar, gate]));

  async function abrirNotificacao(notificacao: Notificacao) {
    if (processandoId !== null) return;
    setProcessandoId(notificacao.id);
    try {
      if (!notificacao.lida) {
        await notificacoesApi.marcarLida(notificacao.id);
        setNotificacoes((atuais) =>
          atuais.map((item) =>
            item.id === notificacao.id ? { ...item, lida: true } : item,
          ),
        );
      }
      if (notificacao.tipo === "nova_despesa" && notificacao.referencia_id) {
        router.push({
          pathname: "/(main)/group/detalhes-despesa",
          params: {
            id: String(notificacao.referencia_id),
            groupId: String(notificacao.grupo_id),
            grupoNome: notificacao.grupo_nome ?? "",
          },
        });
      } else if (notificacao.grupo_id !== null) {
        router.push({
          pathname: notificacao.tipo === "cobranca"
            ? "/(main)/group/saldos"
            : "/(main)/group/despesas-grupo",
          params: { groupId: String(notificacao.grupo_id) },
        });
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar a notificação.");
    } finally {
      setProcessandoId(null);
    }
  }

  async function marcarTodasLidas() {
    if (processandoId !== null) return;
    setProcessandoId(-1);
    setErro(null);
    try {
      await notificacoesApi.marcarTodasLidas();
      setNotificacoes((atuais) =>
        atuais.map((item) => ({ ...item, lida: true })),
      );
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível marcar as notificações como lidas.",
      );
    } finally {
      setProcessandoId(null);
    }
  }

  const possuiNaoLidas = notificacoes.some((item) => !item.lida);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Atualizar notificações"
          style={styles.refresh}
          onPress={() => void carregar()}
          disabled={carregando}
        >
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {possuiNaoLidas && (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.markAll}
          onPress={() => void marcarTodasLidas()}
          disabled={processandoId !== null}
        >
          <Text style={styles.markAllText}>Marcar todas como lidas</Text>
        </TouchableOpacity>
      )}

      {erro && <Text accessibilityRole="alert" style={styles.error}>{erro}</Text>}

      <FlatList
        data={carregando ? [] : notificacoes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onEndReached={() => void carregarMais()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={carregando ? (
          <ActivityIndicator color={Cores.textoPositivo} style={styles.loader} />
        ) : (
          <Text style={styles.empty}>Você ainda não tem notificações.</Text>
        )}
        ListFooterComponent={carregandoMais ? (
          <ActivityIndicator color={Cores.textoPositivo} style={styles.cardLoader} />
        ) : undefined}
        renderItem={({ item: notificacao }) => (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void abrirNotificacao(notificacao)}
              disabled={processandoId !== null}
              style={[styles.card, !notificacao.lida && styles.unread]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{notificacao.titulo}</Text>
                {!notificacao.lida && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.message}>{notificacao.mensagem}</Text>
              <Text style={styles.date}>{formatDateTimeForDisplay(notificacao.criado_em)}</Text>
              {processandoId === notificacao.id && (
                <ActivityIndicator color={Cores.textoPositivo} style={styles.cardLoader} />
              )}
            </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  backText: { color: Cores.texto, fontSize: 30, lineHeight: 34 },
  title: { color: Cores.texto, fontSize: 18, fontWeight: "700" },
  refresh: { minWidth: 64, alignItems: "flex-end", paddingVertical: 10 },
  refreshText: { color: Cores.textoPositivo, fontSize: 12, fontWeight: "700" },
  markAll: { alignSelf: "flex-end", marginHorizontal: 18, paddingVertical: 8 },
  markAllText: { color: Cores.textoPositivo, fontSize: 12, fontWeight: "700" },
  list: { padding: 18, paddingTop: 8, paddingBottom: 30 },
  card: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.cartaoFundo,
  },
  unread: { borderColor: Cores.principal, backgroundColor: Cores.superficieVerde },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { flex: 1, color: Cores.texto, fontSize: 15, fontWeight: "700" },
  unreadDot: { width: 8, height: 8, marginLeft: 10, borderRadius: 4, backgroundColor: Cores.principalEscuro },
  message: { marginTop: 8, color: Cores.textoSecundario, fontSize: 13, lineHeight: 19 },
  date: { marginTop: 10, color: Cores.textoSuave, fontSize: 11 },
  loader: { marginTop: 48 },
  cardLoader: { marginTop: 10 },
  empty: { padding: 28, color: Cores.textoSuave, textAlign: "center" },
  error: {
    marginHorizontal: 18,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    color: Cores.textoNegativo,
    backgroundColor: Cores.superficieNegativa,
    fontSize: 13,
  },
});
