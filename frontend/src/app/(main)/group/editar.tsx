import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import { GROUP_COVER_ICONS } from "@/constants/groupCoverIcons";
import { gruposApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

const NOME_MAX_LENGTH = 120;
const DESCRICAO_MAX_LENGTH = 500;

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function EditarGrupo() {
  const CORES = useAppTheme();
  const styles = createStyles(CORES);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const groupId = Number(params.groupId);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icone, setIcone] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoesIconeAtivas, setOpcoesIconeAtivas] = useState<
    (typeof GROUP_COVER_ICONS)[number][]
  >([]);
  const [carregandoIcones, setCarregandoIcones] = useState(true);
  const [erroIcones, setErroIcones] = useState<string | null>(null);
  const iconeInicial = useRef<string | null>(null);
  const { focusedField, focusHandlers } = useFieldFocus();
  const opcoesIcone: { icone: string; label: string }[] = [...opcoesIconeAtivas];
  if (icone && !opcoesIcone.some((opcao) => opcao.icone === icone)) {
    opcoesIcone.push({
      icone,
      label:
        GROUP_COVER_ICONS.find((opcao) => opcao.icone === icone)?.label
        ?? "atual",
    });
  }

  const carregarIcones = useCallback(
    async (estaAtiva: () => boolean = () => true) => {
      setCarregandoIcones(true);
      setErroIcones(null);
      try {
        const resposta = await gruposApi.listarIconesCapa();
        if (!estaAtiva()) return;

        const iconesAtivos = new Set(
          resposta.data.icones
            .filter((opcao) => opcao.origem === "padrao")
            .map((opcao) => opcao.icone),
        );
        setOpcoesIconeAtivas(
          GROUP_COVER_ICONS.filter((opcao) => iconesAtivos.has(opcao.icone)),
        );
      } catch (falha) {
        if (estaAtiva()) {
          setErroIcones(
            falha instanceof Error
              ? falha.message
              : "Não foi possível carregar os ícones de capa.",
          );
        }
      } finally {
        if (estaAtiva()) setCarregandoIcones(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      void carregarIcones(() => ativo);
      return () => {
        ativo = false;
      };
    }, [carregarIcones]),
  );

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarGrupo() {
        if (!Number.isInteger(groupId) || groupId <= 0) {
          setErro("Grupo não encontrado.");
          setCarregando(false);
          return;
        }

        setCarregando(true);
        setErro(null);
        try {
          const resposta = await gruposApi.buscar(groupId);
          if (!ativo) return;
          if (!resposta.data.pode_editar) {
            setErro("Apenas administradores ativos podem editar o grupo.");
            return;
          }
          setNome(resposta.data.nome);
          setDescricao(resposta.data.descricao ?? "");
          const iconeAtual = resposta.data.icone ?? null;
          iconeInicial.current = iconeAtual;
          setIcone(iconeAtual);
        } catch (falha) {
          if (ativo) {
            setErro(
              falha instanceof Error
                ? falha.message
                : "Não foi possível carregar o grupo.",
            );
          }
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      void carregarGrupo();
      return () => {
        ativo = false;
      };
    }, [groupId]),
  );

  async function salvar() {
    const nomeTrimado = nome.trim();
    const descricaoTrimada = descricao.trim();
    if (nomeTrimado.length < 2) {
      Alert.alert("Atenção", "O nome do grupo deve ter pelo menos 2 caracteres.");
      return;
    }
    if (nomeTrimado.length > NOME_MAX_LENGTH) {
      Alert.alert("Atenção", `O nome deve ter no máximo ${NOME_MAX_LENGTH} caracteres.`);
      return;
    }
    if (descricaoTrimada.length > DESCRICAO_MAX_LENGTH) {
      Alert.alert(
        "Atenção",
        `A descrição deve ter no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`,
      );
      return;
    }
    if (salvando) return;

    setSalvando(true);
    try {
      const dados: {
        nome: string;
        descricao: string;
        icone?: string | null;
      } = {
        nome: nomeTrimado,
        descricao: descricaoTrimada,
      };
      if (
        icone !== iconeInicial.current
        || icone === null
        || GROUP_COVER_ICONS.some((opcao) => opcao.icone === icone)
      ) {
        dados.icone = icone;
      }
      await gruposApi.atualizar(groupId, dados);
      router.back();
    } catch (falha) {
      Alert.alert(
        "Erro",
        falha instanceof Error ? falha.message : "Não foi possível salvar o grupo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
        <View style={styles.estado}>
          <ActivityIndicator size="large" color={CORES.accentDark} />
          <Text style={styles.estadoTexto}>Carregando grupo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
        <View style={styles.erroContainer} accessibilityRole="alert">
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.botaoVoltarTexto}>Voltar ao grupo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.botaoFechar}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Text style={styles.iconeVoltar}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerTextos}>
              <Text style={styles.titulo}>Editar grupo</Text>
              <Text style={styles.subtitulo}>Atualize os dados e a capa do grupo</Text>
            </View>
          </View>

          <View style={styles.previewContainer}>
            <View style={styles.avatarPreview}>
              {icone ? (
                <IconeCategoria icone={icone} tamanho={28} />
              ) : (
                <Text style={styles.avatarIniciais} accessible={false}>
                  {iniciais(nome)}
                </Text>
              )}
            </View>
            <View style={styles.previewTextos}>
              <Text style={styles.previewNome} numberOfLines={1}>
                {nome || "Nome do grupo"}
              </Text>
              <Text style={styles.previewDescricao} numberOfLines={1}>
                {descricao || "Despesas compartilhadas"}
              </Text>
            </View>
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Nome do grupo</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "nome" && styles.inputFocado,
              ]}
              value={nome}
              onChangeText={setNome}
              {...focusHandlers("nome")}
              placeholder="Ex.: Viagem para Bahia"
              placeholderTextColor={CORES.placeholder}
              autoCapitalize="sentences"
              maxLength={NOME_MAX_LENGTH}
              accessibilityLabel="Nome do grupo"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputDescricao,
                focusedField === "descricao" && styles.inputFocado,
              ]}
              value={descricao}
              onChangeText={setDescricao}
              {...focusHandlers("descricao")}
              placeholder="Ex.: Despesas da viagem de julho"
              placeholderTextColor={CORES.placeholder}
              autoCapitalize="sentences"
              multiline
              maxLength={DESCRICAO_MAX_LENGTH}
              textAlignVertical="top"
              accessibilityLabel="Descrição do grupo, opcional"
            />
          </View>

          <View style={styles.seletorCabecalho}>
            <View style={styles.seletorTextos}>
              <Text style={styles.label}>Ícone de capa</Text>
              <Text style={styles.ajuda}>
                Sem ícone, as iniciais do grupo serão exibidas.
              </Text>
              {icone
                && !carregandoIcones
                && !opcoesIconeAtivas.some((opcao) => opcao.icone === icone) && (
                <Text style={styles.ajudaIconeExistente}>
                  O ícone atual será mantido até você escolher outro.
                </Text>
              )}
              {carregandoIcones ? (
                <ActivityIndicator
                  style={styles.carregandoIcones}
                  color={CORES.accentDark}
                />
              ) : erroIcones ? (
                <View style={styles.erroIcones} accessibilityRole="alert">
                  <Text style={styles.ajudaIconeExistente}>{erroIcones}</Text>
                  <TouchableOpacity
                    onPress={() => void carregarIcones()}
                    accessibilityRole="button"
                  >
                    <Text style={styles.tentarNovamente}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : opcoesIconeAtivas.length === 0 && !icone ? (
                <Text style={styles.ajudaIconeExistente}>
                  Nenhum ícone está disponível nas configurações.
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.opcaoSemIcone, icone === null && styles.opcaoSelecionada]}
              onPress={() => setIcone(null)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityLabel="Usar as iniciais do grupo, sem ícone"
              accessibilityState={{ selected: icone === null }}
            >
              <Text style={styles.semIconeTexto}>Aa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gradeIcones}>
            {opcoesIcone.map((opcao) => {
              const selecionado = icone === opcao.icone;
              return (
                <TouchableOpacity
                  key={opcao.icone}
                  style={[styles.opcaoIcone, selecionado && styles.opcaoSelecionada]}
                  onPress={() => setIcone(opcao.icone)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityLabel={`Ícone ${opcao.label}`}
                  accessibilityState={{ selected: selecionado }}
                >
                  <IconeCategoria icone={opcao.icone} tamanho={22} />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
            onPress={() => void salvar()}
            disabled={salvando}
            accessibilityRole="button"
          >
            {salvando ? (
              <View style={styles.carregandoBotao}>
                <ActivityIndicator color={CORES.textoSobrePrincipal} />
                <Text style={styles.botaoSalvarTexto}>Salvando...</Text>
              </View>
            ) : (
              <Text style={styles.botaoSalvarTexto}>Salvar alterações</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (CORES: PaletaSemantica) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: CORES.paper },
    flex: { flex: 1 },
    conteudo: { width: "100%", maxWidth: 640, alignSelf: "center", padding: 20, paddingBottom: 36 },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
    botaoFechar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: CORES.surface,
      borderWidth: 1,
      borderColor: CORES.line,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    iconeVoltar: { fontSize: 32, color: CORES.ink, lineHeight: 34, marginTop: -3 },
    headerTextos: { flex: 1 },
    titulo: { color: CORES.ink, fontSize: 23, fontWeight: "700" },
    subtitulo: { color: CORES.muted, fontSize: 12, marginTop: 4 },
    previewContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: CORES.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: CORES.line,
      padding: 14,
      marginBottom: 22,
    },
    avatarPreview: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    avatarIniciais: { color: CORES.ink, fontSize: 16, fontWeight: "700" },
    previewTextos: { flex: 1, marginLeft: 12 },
    previewNome: { color: CORES.ink, fontWeight: "700", fontSize: 14 },
    previewDescricao: { color: CORES.muted, fontSize: 12, marginTop: 4 },
    campo: { marginBottom: 18 },
    label: { color: CORES.ink, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    input: {
      minHeight: 50,
      backgroundColor: CORES.surface,
      borderWidth: 1,
      borderColor: CORES.line,
      borderRadius: 12,
      paddingHorizontal: 14,
      color: CORES.ink,
      fontSize: 14,
    },
    inputFocado: { borderWidth: 2, borderColor: CORES.accentDark },
    inputDescricao: { minHeight: 96, paddingTop: 12 },
    seletorCabecalho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 2,
      marginBottom: 12,
    },
    seletorTextos: { flex: 1 },
    ajuda: { color: CORES.muted, fontSize: 11, lineHeight: 16, marginTop: -4 },
    ajudaIconeExistente: { color: CORES.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
    carregandoIcones: { alignSelf: "flex-start", marginTop: 10 },
    erroIcones: { marginTop: 4 },
    tentarNovamente: {
     color: CORES.accentDark,
     fontSize: 11,
     fontWeight: "700",
     marginTop: 5,
    },
    opcaoSemIcone: {
      width: 48,
      height: 48,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: CORES.line,
      borderRadius: 10,
      backgroundColor: CORES.surface,
    },
    semIconeTexto: { color: CORES.muted, fontSize: 12, fontWeight: "700" },
    gradeIcones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    opcaoIcone: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: CORES.line,
      borderRadius: 12,
      backgroundColor: CORES.surface,
    },
    opcaoSelecionada: {
      borderWidth: 2,
      borderColor: CORES.accentDark,
      backgroundColor: CORES.superficieVerdeSelecionada,
    },
    botaoSalvar: {
      minHeight: 52,
      borderRadius: 13,
      backgroundColor: CORES.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    botaoDesabilitado: { opacity: 0.65 },
    carregandoBotao: { flexDirection: "row", alignItems: "center", gap: 9 },
    botaoSalvarTexto: {
      color: CORES.textoSobrePrincipal,
      fontSize: 14,
      fontWeight: "700",
    },
    botaoCancelar: { minHeight: 46, justifyContent: "center", alignItems: "center" },
    botaoCancelarTexto: { color: CORES.muted, fontSize: 13, fontWeight: "600" },
    estado: { flex: 1, justifyContent: "center", alignItems: "center" },
    estadoTexto: { color: CORES.muted, fontSize: 12, marginTop: 12 },
    erroContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    erroTexto: { color: CORES.textoErro, fontSize: 14, textAlign: "center" },
    botaoVoltar: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 18,
      marginTop: 16,
      borderRadius: 12,
      backgroundColor: CORES.superficieVerdeSelecionada,
    },
    botaoVoltarTexto: { color: CORES.ink, fontSize: 13, fontWeight: "700" },
  });
