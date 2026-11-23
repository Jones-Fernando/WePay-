import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import { GROUP_COVER_ICONS } from "@/constants/groupCoverIcons";
import { gruposApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";

const NOME_MIN_LENGTH = 2;
const DESCRICAO_MAX_LENGTH = 200;

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function NovoGrupo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icone, setIcone] = useState<string | null>(null);
  const [opcoesIcone, setOpcoesIcone] = useState<
    (typeof GROUP_COVER_ICONS)[number][]
  >([]);
  const [carregandoIcones, setCarregandoIcones] = useState(true);
  const [erroIcones, setErroIcones] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

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
        const opcoesVisiveis = GROUP_COVER_ICONS.filter((opcao) =>
          iconesAtivos.has(opcao.icone),
        );
        setOpcoesIcone(opcoesVisiveis);
        setIcone((atual) => {
          if (atual && iconesAtivos.has(atual)) return atual;
          if (iconesAtivos.has("👥")) return "👥";
          return opcoesVisiveis[0]?.icone ?? null;
        });
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

  const nomeTrimado = nome.trim();
  const descricaoTrimada = descricao.trim();
  const erroNome =
    nomeTrimado.length > 0 && nomeTrimado.length < NOME_MIN_LENGTH
      ? `O nome do grupo deve ter pelo menos ${NOME_MIN_LENGTH} caracteres.`
      : "";
  const erroDescricao =
    descricaoTrimada.length > DESCRICAO_MAX_LENGTH
      ? `A descrição deve ter no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`
      : "";

  async function criar() {
    const titulo = nomeTrimado;

    if (!titulo) {
      Alert.alert("Atenção", "Digite o nome do grupo.");
      return;
    }

    if (titulo.length < NOME_MIN_LENGTH) {
      Alert.alert(
        "Atenção",
        `O nome do grupo deve ter pelo menos ${NOME_MIN_LENGTH} caracteres.`
      );
      return;
    }

    if (descricaoTrimada.length > DESCRICAO_MAX_LENGTH) {
      Alert.alert(
        "Atenção",
        `A descrição deve ter no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`
      );
      return;
    }

    if (salvando) return;

    try {
      setSalvando(true);
      await gruposApi.criar({
        nome: titulo,
        descricao: descricaoTrimada || undefined,
        icone,
      });
      Alert.alert(
        "Grupo criado",
        "Convide participantes para começar a dividir despesas.",
        [{ text: "OK", onPress: () => router.replace("/(main)/group") }]
      );
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error ? erro.message : "Não foi possível criar o grupo."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        style={styles.teclado}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formulario}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.botaoVoltar}
                onPress={() => router.back()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Text style={styles.voltar}>‹</Text>
              </TouchableOpacity>
              <View style={styles.headerTexto}>
                <Text style={styles.titulo}>Novo grupo</Text>
                <Text style={styles.subtitulo}>
                  Organize despesas para dividir com outras pessoas
                </Text>
              </View>
            </View>

            <View style={styles.introducao}>
              <View style={styles.iconeGrupo} accessible={false}>
                {icone ? (
                  <IconeCategoria icone={icone} tamanho={24} />
                ) : (
                  <Text style={styles.emojiGrupo}>
                    {iniciais(nome) || "GR"}
                  </Text>
                )}
              </View>
              <View style={styles.introducaoTexto}>
                <Text style={styles.introducaoTitulo}>
                  Um espaço para dividir juntos
                </Text>
                <Text style={styles.introducaoSubtitulo}>
                  Registre despesas compartilhadas em um só lugar.
                </Text>
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Nome do grupo</Text>
              <TextInput
                style={[
                  styles.input,
                  erroNome ? styles.inputErro : null,
                  !erroNome && focusedField === "nome" && styles.focusedField,
                ]}
                value={nome}
                onChangeText={setNome}
                {...focusHandlers("nome")}
                placeholder="Ex.: Viagem para Bahia"
                placeholderTextColor={Cores.placeholder}
                autoCapitalize="sentences"
                returnKeyType="next"
                maxLength={80}
                accessibilityLabel="Nome do grupo"
              />
              <Text style={[styles.ajudaCampo, erroNome ? styles.erroTexto : null]}>
                {erroNome || "Escolha um nome fácil de reconhecer por todos."}
              </Text>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputDescricao,
                  erroDescricao ? styles.inputErro : null,
                  !erroDescricao && focusedField === "descricao" && styles.focusedField,
                ]}
                value={descricao}
                onChangeText={setDescricao}
                {...focusHandlers("descricao")}
                placeholder="Ex.: Despesas da viagem de julho"
                placeholderTextColor={Cores.placeholder}
                autoCapitalize="sentences"
                multiline
                maxLength={DESCRICAO_MAX_LENGTH + 20}
                textAlignVertical="top"
                accessibilityLabel="Descrição do grupo, opcional"
              />
              <Text style={[styles.ajudaCampo, erroDescricao ? styles.erroTexto : null]}>
                {erroDescricao || `Máximo de ${DESCRICAO_MAX_LENGTH} caracteres.`}
              </Text>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Ícone da capa</Text>
              <Text style={styles.ajudaCampo}>
                Escolha um ícone para identificar o grupo. Você poderá alterá-lo
                depois.
              </Text>
              {carregandoIcones ? (
                <View style={styles.carregandoIcones}>
                  <ActivityIndicator color={Cores.accentDark} />
                </View>
              ) : erroIcones ? (
                <View style={styles.erroIcones}>
                  <Text style={[styles.ajudaCampo, styles.erroTexto]}>
                    {erroIcones}
                  </Text>
                  <TouchableOpacity
                    onPress={() => void carregarIcones()}
                    accessibilityRole="button"
                  >
                    <Text style={styles.tentarNovamente}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : opcoesIcone.length === 0 ? (
                <Text style={styles.ajudaCampo}>
                  Nenhum ícone está disponível. Você ainda pode usar as iniciais
                  do grupo.
                </Text>
              ) : null}
              <View style={styles.gradeIcones}>
                <TouchableOpacity
                  style={[
                    styles.opcaoIcone,
                    icone === null && styles.opcaoIconeSelecionada,
                  ]}
                  onPress={() => setIcone(null)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityLabel="Usar as iniciais do grupo, sem ícone"
                  accessibilityState={{ selected: icone === null }}
                >
                  <Text style={styles.opcaoSemIcone}>Aa</Text>
                </TouchableOpacity>
                {opcoesIcone.map((opcao) => {
                  const selecionado = icone === opcao.icone;
                  return (
                    <TouchableOpacity
                      key={opcao.icone}
                      style={[
                        styles.opcaoIcone,
                        selecionado && styles.opcaoIconeSelecionada,
                      ]}
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
            </View>

            <View style={styles.aviso}>
              <View style={styles.avisoIcone}>
                <Text style={styles.avisoIconeTexto}>✉</Text>
              </View>
              <View style={styles.avisoConteudo}>
                <Text style={styles.avisoTitulo}>Convide participantes depois</Text>
                <Text style={styles.avisoTexto}>
                  Depois de criar o grupo, você poderá enviar convites por e-mail
                  na tela de participantes.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
              onPress={criar}
              disabled={salvando}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {salvando ? (
                <View style={styles.carregando}>
                  <ActivityIndicator color={Cores.texto} />
                  <Text style={styles.botaoSalvarTexto}>Criando grupo...</Text>
                </View>
              ) : (
                <Text style={styles.botaoSalvarTexto}>Criar grupo</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoCancelar}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  teclado: { flex: 1 },
  conteudo: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },
  formulario: { width: "100%", maxWidth: 620, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 22,
  },
  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  voltar: { fontSize: 32, color: Cores.texto, marginTop: -3 },
  headerTexto: { flex: 1 },
  titulo: { fontSize: 22, fontWeight: "700", color: Cores.texto },
  subtitulo: { fontSize: 12, color: Cores.textoSuave, marginTop: 4, lineHeight: 17 },
  introducao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.superficieVerde,
    borderWidth: 1,
    borderColor: Cores.bordaDestaque,
    borderRadius: 16,
    padding: 14,
    marginBottom: 25,
  },
  iconeGrupo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: Cores.cartaoFundo,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emojiGrupo: { fontSize: 15, fontWeight: "700", color: Cores.texto },
  introducaoTexto: { flex: 1 },
  introducaoTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 3,
  },
  introducaoSubtitulo: { fontSize: 11, color: Cores.textoSuave, lineHeight: 16 },
  campo: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.texto,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 14,
    color: Cores.texto,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  focusedField: { borderWidth: 2, borderColor: Cores.textoPositivo },
  ajudaCampo: { fontSize: 11, color: Cores.textoSuave, marginTop: 7, lineHeight: 16 },
  erroTexto: { color: Cores.textoNegativo },
  carregandoIcones: { paddingVertical: 12, alignItems: "flex-start" },
  erroIcones: { marginTop: 2 },
  tentarNovamente: {
    color: Cores.textoPositivo,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  inputErro: { borderColor: Cores.negativo },
  inputDescricao: { height: 112, paddingTop: 14 },
  gradeIcones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  opcaoIcone: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    alignItems: "center",
    justifyContent: "center",
  },
  opcaoIconeSelecionada: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
    backgroundColor: Cores.superficieVerdeSelecionada,
  },
  opcaoSemIcone: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "700",
  },
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Cores.superficieVerde,
    borderWidth: 1,
    borderColor: Cores.bordaDestaque,
    borderRadius: 15,
    padding: 15,
    marginTop: 1,
    marginBottom: 23,
  },
  avisoIcone: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: Cores.cartaoFundo,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  avisoIconeTexto: { fontSize: 18, color: Cores.textoPositivo },
  avisoConteudo: { flex: 1 },
  avisoTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 4,
  },
  avisoTexto: { fontSize: 11, color: Cores.textoSuave, lineHeight: 17 },
  botaoSalvar: {
    height: 54,
    backgroundColor: Cores.principal,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  botaoSalvarTexto: { fontSize: 15, fontWeight: "700", color: Cores.textoSobrePrincipal },
  carregando: { flexDirection: "row", alignItems: "center", gap: 9 },
  botaoDesabilitado: { opacity: 0.6 },
  botaoCancelar: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  botaoCancelarTexto: { fontSize: 13, fontWeight: "600", color: Cores.textoSuave },
});
