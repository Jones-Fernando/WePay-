import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { gruposApi, Grupo } from "@/services/api";

const CORES = {
  paper: "#F5FBF7",
  ink: "#0B3B33",
  surface: "#FFFFFF",
  accent: "#00C896",
  accentDark: "#00A17A",
  muted: "#6B8F86",
  line: "#E1EEE8",
  field: "#F0F8F4",
};

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function ListaGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (mostrarLoading = true) => {
    if (mostrarLoading) {
      setCarregando(true);
    } else {
      setAtualizando(true);
    }

    try {
      const resposta = await gruposApi.listar();
      setGrupos(resposta.data);
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar os grupos."
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo
      ? grupos.filter((grupo) => grupo.nome.toLowerCase().includes(termo))
      : grupos;
  }, [busca, grupos]);

  function voltar() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main)/home");
    }
  }

  function abrirGrupo(grupo: Grupo) {
    router.push({
      pathname: "/(main)/group/despesas-grupo",
      params: { groupId: String(grupo.id), grupoNome: grupo.nome },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageColumn}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={voltar}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
          >
            <Text style={styles.iconeVoltar}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTextos}>
            <Text style={styles.titulo}>Seus grupos</Text>
            <Text style={styles.subtitulo}>
              Gerencie suas despesas compartilhadas
            </Text>
          </View>
        </View>

        <View style={styles.conteudo}>
          <View style={styles.cardResumo}>
            <Text style={styles.resumoLabel}>Grupos ativos</Text>
            <Text style={styles.resumoValor}>{grupos.length}</Text>
            <Text style={styles.resumoNota}>
              {grupos.length === 1
                ? "grupo para acompanhar"
                : "grupos para acompanhar"}
            </Text>
          </View>

          <View style={styles.buscaContainer}>
            <Text style={styles.buscaIcone}>⌕</Text>
            <TextInput
              style={styles.buscaInput}
              placeholder="Pesquisar grupo"
              placeholderTextColor={CORES.muted}
              value={busca}
              onChangeText={setBusca}
              returnKeyType="search"
              accessibilityLabel="Pesquisar grupos"
            />
          </View>

          <FlatList
            data={carregando ? [] : gruposFiltrados}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            style={styles.flatList}
            contentContainerStyle={styles.lista}
            refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={() => carregar(false)}
                tintColor={CORES.accentDark}
              />
            }
            ListHeaderComponent={
              !carregando && gruposFiltrados.length > 0 ? (
                <View style={styles.linhaTitulo}>
                  <Text style={styles.secaoTitulo}>Seus grupos</Text>
                  <Text style={styles.quantidade}>
                    {gruposFiltrados.length}
                  </Text>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              carregando ? (
                <View style={styles.estado}>
                  <ActivityIndicator
                    size="large"
                    color={CORES.accentDark}
                  />
                  <Text style={styles.estadoTexto}>
                    Carregando grupos...
                  </Text>
                </View>
              ) : (
                <View style={styles.vazio}>
                  <Text style={styles.vazioIcone}>
                    {busca ? "🔎" : "👥"}
                  </Text>
                  <Text style={styles.vazioTitulo}>
                    {busca
                      ? "Nenhum grupo encontrado"
                      : "Nenhum grupo criado"}
                  </Text>
                  <Text style={styles.vazioTexto}>
                    {busca
                      ? "Tente pesquisar por outro nome."
                      : "Toque no botão + para criar seu primeiro grupo."}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.cardGrupo}
                onPress={() => abrirGrupo(item)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Abrir grupo ${item.nome}`}
              >
                <View style={styles.cardGrupoConteudo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>
                      {iniciais(item.nome)}
                    </Text>
                  </View>
                  <View style={styles.cardTextos}>
                    <Text style={styles.nomeGrupo} numberOfLines={1}>
                      {item.nome}
                    </Text>
                    <Text style={styles.descricaoGrupo} numberOfLines={1}>
                      {item.descricao || "Despesas compartilhadas"}
                    </Text>
                  </View>
                  <Text style={styles.seta}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.fabContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push("/(main)/group/novo")}
            accessibilityRole="button"
            accessibilityLabel="Criar grupo"
          >
            <Text style={styles.fabTexto}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CORES.paper,
  },
  pageColumn: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
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
    color: CORES.ink,
    fontSize: 23,
    fontWeight: "700",
  },
  subtitulo: {
    color: CORES.muted,
    fontSize: 12,
    marginTop: 4,
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardResumo: {
    backgroundColor: CORES.field,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  resumoLabel: {
    color: CORES.muted,
    fontSize: 11,
  },
  resumoValor: {
    color: CORES.ink,
    fontSize: 25,
    fontWeight: "600",
    marginTop: 5,
  },
  resumoNota: {
    color: CORES.muted,
    fontSize: 11,
    marginTop: 5,
  },
  buscaContainer: {
    height: 52,
    backgroundColor: CORES.surface,
    borderWidth: 1,
    borderColor: CORES.line,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  buscaIcone: {
    color: CORES.muted,
    fontSize: 23,
    marginRight: 8,
  },
  buscaInput: {
    flex: 1,
    color: CORES.ink,
    fontSize: 14,
    paddingVertical: 0,
  },
  flatList: {
    flex: 1,
  },
  lista: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  linhaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  secaoTitulo: {
    color: CORES.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  quantidade: {
    color: CORES.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  cardGrupo: {
    backgroundColor: CORES.surface,
    borderWidth: 1,
    borderColor: CORES.line,
    borderRadius: 14,
    marginBottom: 10,
  },
  cardGrupoConteudo: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#DDF7EE",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTexto: {
    color: CORES.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  cardTextos: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nomeGrupo: {
    color: CORES.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  descricaoGrupo: {
    color: CORES.muted,
    fontSize: 11,
    marginTop: 4,
  },
  seta: {
    color: CORES.accentDark,
    fontSize: 24,
  },
  estado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
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
  fabContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 82,
    alignItems: "flex-end",
    paddingHorizontal: 20,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: CORES.accent,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: CORES.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
  },
  fabTexto: {
    color: CORES.ink,
    fontSize: 28,
    fontWeight: "600",
    marginTop: -2,
  },
});
