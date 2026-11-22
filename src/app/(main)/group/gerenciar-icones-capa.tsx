import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import { GROUP_COVER_ICONS } from "@/constants/groupCoverIcons";
import { gruposApi } from "@/services/api";
import { Alert } from "@/services/feedback";

export default function GerenciarIconesCapa() {
  const CORES = useAppTheme();
  const styles = createStyles(CORES);
  const esquema = useAppThemeScheme();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [salvos, setSalvos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<
    "carregar" | "salvar" | "restaurar"
  >("carregar");

  const carregar = useCallback(
    async (estaAtiva: () => boolean = () => true) => {
      setCarregando(true);
      setErro(null);
      setAcaoErro("carregar");
      try {
        const resposta = await gruposApi.listarIconesCapa();
        if (!estaAtiva()) return;

        const ativos = [
          ...new Set(
            resposta.data.icones
              .filter((opcao) => opcao.origem === "padrao")
              .map((opcao) => opcao.icone),
          ),
        ];
        setSelecionados(ativos);
        setSalvos(ativos);
      } catch (falha) {
        if (estaAtiva()) {
          setAcaoErro("carregar");
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível carregar as opções de ícones.",
          );
        }
      } finally {
        if (estaAtiva()) setCarregando(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      void carregar(() => ativo);
      return () => {
        ativo = false;
      };
    }, [carregar]),
  );

  const selecionadosOrdenados = [...selecionados].sort();
  const salvosOrdenados = [...salvos].sort();
  const alterado =
    JSON.stringify(selecionadosOrdenados) !== JSON.stringify(salvosOrdenados);

  function alternar(icone: string) {
    setSelecionados((atuais) =>
      atuais.includes(icone)
        ? atuais.filter((item) => item !== icone)
        : [...atuais, icone],
    );
    setErro(null);
    setAcaoErro("carregar");
  }

  async function salvar() {
    if (salvando || !alterado) return;

    setSalvando(true);
    setErro(null);
    setAcaoErro("salvar");
    try {
      const iconesOcultos = GROUP_COVER_ICONS
        .map((opcao) => opcao.icone)
        .filter((icone) => !selecionados.includes(icone));
      await gruposApi.atualizarIconesCapa(iconesOcultos);
      setSalvos(selecionados);
      Alert.alert("Ícones atualizados", "A seleção será usada ao criar ou editar grupos.");
    } catch (falha) {
      setAcaoErro("salvar");
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível salvar a seleção.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function restaurarPadrao() {
    setSalvando(true);
    setErro(null);
    setAcaoErro("restaurar");
    try {
      await gruposApi.restaurarIconesCapa();
      await carregar();
    } catch (falha) {
      setAcaoErro("restaurar");
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível restaurar os ícones padrão.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function confirmarRestauracao() {
    Alert.alert(
      "Restaurar ícones padrão",
      "Isso substituirá sua seleção atual pelos ícones padrão do sistema.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restaurar",
          onPress: () => void restaurarPadrao(),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar às configurações"
          >
            <Text style={styles.iconeVoltar}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTextos}>
            <Text style={styles.titulo}>Ícones de capa</Text>
            <Text style={styles.subtitulo}>
              Escolha quais aparecem ao criar ou editar um grupo.
            </Text>
          </View>
        </View>

        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            Os grupos existentes não serão alterados. Toque nos ícones para
            incluir ou remover opções.
          </Text>
        </View>

        {erro ? (
          <View style={styles.erroContainer} accessibilityRole="alert">
            <Text style={styles.erroTexto}>{erro}</Text>
            {carregando ? null : (
              <TouchableOpacity
                onPress={() => {
                  if (acaoErro === "salvar") void salvar();
                  else if (acaoErro === "restaurar") void restaurarPadrao();
                  else void carregar();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.tentarNovamente}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {carregando ? (
          <View style={styles.estado}>
            <ActivityIndicator size="large" color={CORES.accentDark} />
            <Text style={styles.estadoTexto}>Carregando ícones...</Text>
          </View>
        ) : (
          <View style={styles.grade}>
            {GROUP_COVER_ICONS.map((opcao) => {
              const selecionado = selecionados.includes(opcao.icone);
              return (
                <TouchableOpacity
                  key={opcao.icone}
                  style={[
                    styles.opcaoIcone,
                    selecionado && styles.opcaoSelecionada,
                    salvando && styles.opcaoDesabilitada,
                  ]}
                  onPress={() => alternar(opcao.icone)}
                  disabled={salvando}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Ícone ${opcao.label}`}
                  accessibilityState={{ checked: selecionado }}
                >
                  <IconeCategoria icone={opcao.icone} tamanho={24} />
                  {selecionado ? (
                    <View style={styles.indicadorSelecionado}>
                      <Text style={styles.indicadorTexto}>✓</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.botaoSalvar,
            (!alterado || salvando || carregando) && styles.botaoDesabilitado,
          ]}
          onPress={() => void salvar()}
          disabled={!alterado || salvando || carregando}
          accessibilityRole="button"
        >
          {salvando ? (
            <View style={styles.carregandoBotao}>
              <ActivityIndicator color={CORES.textoSobrePrincipal} />
              <Text style={styles.botaoSalvarTexto}>Salvando...</Text>
            </View>
          ) : (
            <Text style={styles.botaoSalvarTexto}>Salvar seleção</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoRestaurar}
          onPress={confirmarRestauracao}
          disabled={salvando || carregando}
          accessibilityRole="button"
        >
          <Text style={styles.botaoRestaurarTexto}>Restaurar ícones padrão</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (CORES: PaletaSemantica) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: CORES.paper },
    conteudo: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 36,
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    botaoVoltar: {
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
    titulo: { color: CORES.ink, fontSize: 22, fontWeight: "700" },
    subtitulo: { color: CORES.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
    aviso: {
      backgroundColor: CORES.surface,
      borderWidth: 1,
      borderColor: CORES.line,
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
    },
    avisoTexto: { color: CORES.muted, fontSize: 12, lineHeight: 18 },
    erroContainer: {
      backgroundColor: CORES.superficieErro,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    erroTexto: { color: CORES.textoNegativo, fontSize: 12, lineHeight: 17 },
    tentarNovamente: {
      color: CORES.accentDark,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 7,
    },
    estado: {
      minHeight: 160,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    estadoTexto: { color: CORES.muted, fontSize: 12 },
    grade: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: 9,
      marginBottom: 24,
    },
    opcaoIcone: {
      width: 50,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: CORES.line,
      borderRadius: 12,
      backgroundColor: CORES.surface,
      position: "relative",
    },
    opcaoSelecionada: {
      backgroundColor: CORES.superficieVerdeSelecionada,
      borderColor: CORES.accentDark,
      borderWidth: 2,
    },
    opcaoDesabilitada: { opacity: 0.6 },
    indicadorSelecionado: {
      position: "absolute",
      right: -5,
      top: -5,
      width: 17,
      height: 17,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: CORES.accentDark,
    },
    indicadorTexto: { color: CORES.textoSobrePrincipal, fontSize: 10, fontWeight: "700" },
    botaoSalvar: {
      minHeight: 50,
      borderRadius: 13,
      backgroundColor: CORES.accentDark,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    botaoSalvarTexto: {
      color: CORES.textoSobrePrincipal,
      fontSize: 14,
      fontWeight: "700",
    },
    carregandoBotao: { flexDirection: "row", alignItems: "center", gap: 9 },
    botaoDesabilitado: { opacity: 0.55 },
    botaoRestaurar: {
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    botaoRestaurarTexto: {
      color: CORES.accentDark,
      fontSize: 13,
      fontWeight: "700",
    },
  });
