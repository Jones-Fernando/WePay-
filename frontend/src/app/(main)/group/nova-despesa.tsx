import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";

/**
 * WEPAY — NOVA DESPESA EM GRUPO
 *
 * Mesmo padrão visual de nova-despesa-pessoal.tsx,
 * com campos específicos para despesas compartilhadas.
 *
 * Os participantes são carregados da API do grupo.
 */

import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { IconeCategoria } from "@/components/IconeCategoria";
import CalendarioData from "@/components/CalendarioData";
import { despesasGrupoApi, participantesApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import {
  formatCurrencyInput,
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToIso,
} from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { CATEGORIAS_GRUPO as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";

type Participante = {
  id: string;
  nome: string;
  iniciais: string;
};

function obterParametro(
  parametro: string | string[] | undefined
): string {
  if (Array.isArray(parametro)) {
    return parametro[0] ?? "";
  }

  return parametro ?? "";
}

export default function NovaDespesaGrupo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("grupo", CATEGORIAS);

  const groupId = obterParametro(params.groupId);
  const nomeGrupo =
    obterParametro(params.grupoNome) || "Despesa compartilhada";

  // Dados básicos da despesa.
  const [descricao, setDescricao] = useState(() =>
    obterParametro(params.descricao)
  );

  const [valor, setValor] = useState(() =>
    formatCurrencyInput(obterParametro(params.valor))
  );

  const [data, setData] = useState(() =>
    normalizeDateInput(obterParametro(params.data))
  );

  const [categoria, setCategoria] = useState(() => {
    const categoriaRecebida = obterParametro(params.categoria);

    return categorias.some(
      (item) => item.nome === categoriaRecebida
    )
      ? categoriaRecebida
      : "Alimentação";
  });

  const [observacao, setObservacao] = useState("");

  // Dados específicos do grupo.
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [pagadorId, setPagadorId] = useState("");

  const [participantesSelecionados, setParticipantesSelecionados] =
    useState<string[]>([]);

  const tipoDivisao = "IGUAL" as const;
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorData, setMostrarSeletorData] = useState(false);
  const [campoFocado, setCampoFocado] = useState<string | null>(null);

  const descricaoLimpa = descricao.trim();
  const valorNumerico = parseCurrencyInput(valor);
  const dataLimpa = data.trim();

  function selecionarData(dataSelecionada: string) {
    setData(dataSelecionada);
    setMostrarSeletorData(false);
  }

  useEffect(() => {
    if (!groupId || !Number.isInteger(Number(groupId))) return;
    let ativo = true;
    participantesApi.listarTodos(Number(groupId)).then((data) => {
      if (!ativo) return;
      const lista = data.filter((item) => item.ativo).map((item) => ({
        id: String(item.usuario_id),
        nome: item.nome || item.email || `Participante ${item.usuario_id}`,
        iniciais: (item.nome || item.email || "?").split(" ").slice(0, 2).map((nome) => nome[0]).join("").toUpperCase(),
      }));
      setParticipantes(lista);
      setParticipantesSelecionados(lista.map((item) => item.id));
      setPagadorId((atual) => atual || lista[0]?.id || "");
    }).catch((erro) => Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os participantes."));
    return () => { ativo = false; };
  }, [groupId]);

  // Atualiza o formulário caso o leitor de recibo devolva os dados
  // pelos parâmetros da rota.
  function voltarParaTelaAnterior() {
    router.back();
  }

  function lerRecibo() {
    router.push({
      pathname: "/(main)/receipt-reader/ler-recibo",
      params: {
        origem: "grupo",
        modo: "criar",
        groupId,
        grupoNome: nomeGrupo,
      },
    });
  }

  function alternarParticipante(id: string) {
    setParticipantesSelecionados((atuais) => {
      if (atuais.includes(id)) {
        return atuais.filter((item) => item !== id);
      }

      return [...atuais, id];
    });
  }

  function validarDivisao(valorNumerico: number): boolean {
    if (participantesSelecionados.length === 0) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um participante para dividir a despesa."
      );
      return false;
    }
    void valorNumerico;
    return true;
  }

  async function salvarDespesa() {
    if (salvando) {
      return;
    }

    if (!groupId) {
      Alert.alert(
        "Grupo não identificado",
        "Abra o formulário pela tela de despesas do grupo para continuar."
      );

      return;
    }

    if (!descricaoLimpa) {
      Alert.alert(
        "Atenção",
        "Digite a descrição da despesa."
      );

      return;
    }

    if (
      !valor.trim() ||
      !Number.isFinite(valorNumerico) ||
      valorNumerico <= 0
    ) {
      Alert.alert(
        "Atenção",
        "Digite um valor válido para a despesa."
      );

      return;
    }

    const dataIso = parseDateInputToIso(dataLimpa);
    if (!dataIso) {
      Alert.alert(
        "Data inválida",
        "Informe uma data válida no formato DD/MM/AAAA."
      );

      return;
    }

    if (!validarDivisao(valorNumerico)) {
      return;
    }

    const tipoApi = "igual";
    setSalvando(true);
    try {
      await despesasGrupoApi.criar({
        grupo_id: Number(groupId), descricao: descricaoLimpa, valor: valorNumerico,
        data_despesa: dataIso, categoria, observacao: observacao.trim(),
        pagador_id: Number(pagadorId),
        participantes: participantesSelecionados.map(Number), divisao_tipo: tipoApi,
      });
      Alert.alert("Despesa registrada", "A despesa foi dividida e os saldos foram recalculados.", [
        { text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/despesas-grupo", params: { groupId, grupoNome: nomeGrupo } }) },
      ]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível registrar a despesa.");
    } finally {
      setSalvando(false);
    }
  }

  const valorPorPessoa =
    Number.isFinite(valorNumerico) &&
    valorNumerico > 0 &&
    participantesSelecionados.length > 0
      ? valorNumerico / participantesSelecionados.length
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* CABEÇALHO */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={voltarParaTelaAnterior}
              activeOpacity={0.8}
            >
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTexto}>
              <Text style={styles.titulo}>
                Nova despesa em grupo
              </Text>

              <Text style={styles.subtitulo}>
                {nomeGrupo}
              </Text>
            </View>
          </View>

          {/* LEITURA DE RECIBO COM IA */}

          <TouchableOpacity
            style={styles.cardIA}
            activeOpacity={0.85}
            onPress={lerRecibo}
          >
            <View style={styles.iconeIA}>
              <Text style={styles.iconeIAText}>📷</Text>
            </View>

            <View style={styles.iaTexto}>
              <Text style={styles.iaTitulo}>
                Ler recibo com foto
              </Text>

              <Text style={styles.iaSubtitulo}>
                Preencha os dados automaticamente com IA
              </Text>
            </View>

            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>

          {/* DESCRIÇÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>Descrição</Text>

            <TextInput
              style={[
                styles.input,
                campoFocado === "descricao" && styles.campoFocado,
              ]}
              placeholder="Ex.: Mercado, jantar, hospedagem"
              placeholderTextColor={Cores.placeholder}
              value={descricao}
              onChangeText={setDescricao}
              onFocus={() => setCampoFocado("descricao")}
              onBlur={() =>
                setCampoFocado((campo) => campo === "descricao" ? null : campo)
              }
              autoCapitalize="sentences"
              maxLength={120}
            />
          </View>

          {/* VALOR TOTAL */}

          <View style={styles.campo}>
            <Text style={styles.label}>Valor total</Text>

            <View
              style={[
                styles.valorContainer,
                campoFocado === "valor" && styles.campoFocado,
              ]}
            >
              <Text style={styles.simbolo}>R$</Text>

              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor={Cores.placeholder}
                value={valor}
                onChangeText={(texto) => setValor(formatCurrencyInput(texto))}
                onFocus={() => setCampoFocado("valor")}
                onBlur={() =>
                  setCampoFocado((campo) => campo === "valor" ? null : campo)
                }
                keyboardType="decimal-pad"
              />
            </View>

            {tipoDivisao === "IGUAL" &&
              valorNumerico > 0 &&
              participantesSelecionados.length > 0 && (
                <Text style={styles.ajuda}>
                  Divisão igual estimada:{" "}
                  {formatCurrencyBRL(valorPorPessoa)} por pessoa.
                </Text>
              )}
          </View>

          {/* DATA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              testID="group-date-selector"
              style={styles.seletorData}
              onPress={() => setMostrarSeletorData(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Data ${data || "não selecionada"}. Abrir calendário`}
            >
              <Text style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}>{data || "Escolher data"}</Text>
              <Feather
                name="calendar"
                size={16}
                color={Cores.textoSuave}
                accessible={false}
              />
            </TouchableOpacity>
          </View>

          {/* CATEGORIA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categorias}
            >
              {categorias.map((item) => {
                const selecionada = categoria === item.nome;

                return (
                  <TouchableOpacity
                    key={item.nome}
                    style={[
                      styles.categoria,
                      selecionada && styles.categoriaSelecionada,
                    ]}
                    onPress={() => setCategoria(item.nome)}
                    activeOpacity={0.8}
                  >
                    <IconeCategoria icone={item.icone} tamanho={15} style={{ marginRight: 5 }} />

                    <Text
                      style={[
                        styles.categoriaTexto,
                        selecionada &&
                          styles.categoriaTextoSelecionado,
                      ]}
                    >
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {erroCategorias && <Text style={styles.erroCategorias}>{erroCategorias}</Text>}
          </View>

          {/* QUEM PAGOU */}

          <View style={styles.campo}>
            <Text style={styles.label}>Quem pagou?</Text>

            <Text style={styles.descricaoSecao}>
              Selecione quem realizou o pagamento.
            </Text>

            <View style={styles.listaOpcoes}>
              {participantes.map((participante) => {
                const selecionado = pagadorId === participante.id;

                return (
                  <TouchableOpacity
                    key={participante.id}
                    style={[
                      styles.opcaoPessoa,
                      selecionado && styles.opcaoPessoaSelecionada,
                    ]}
                    onPress={() => setPagadorId(participante.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.avatar,
                        selecionado && styles.avatarSelecionado,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarTexto,
                          selecionado && styles.avatarTextoSelecionado,
                        ]}
                      >
                        {participante.iniciais}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.nomePessoa,
                        selecionado && styles.nomePessoaSelecionado,
                      ]}
                    >
                      {participante.nome}
                    </Text>

                    <View
                      style={[
                        styles.radio,
                        selecionado && styles.radioSelecionado,
                      ]}
                    >
                      {selecionado && (
                        <View style={styles.radioCentro} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* PARTICIPANTES DA DIVISÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>
              Quem vai dividir a despesa?
            </Text>

            <Text style={styles.descricaoSecao}>
              Toque para incluir ou retirar participantes.
            </Text>

            <View style={styles.listaOpcoes}>
              {participantes.map((participante) => {
                const selecionado =
                  participantesSelecionados.includes(participante.id);

                return (
                  <TouchableOpacity
                    key={participante.id}
                    style={[
                      styles.opcaoPessoa,
                      selecionado && styles.opcaoPessoaSelecionada,
                    ]}
                    onPress={() =>
                      alternarParticipante(participante.id)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.avatar,
                        selecionado && styles.avatarSelecionado,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarTexto,
                          selecionado && styles.avatarTextoSelecionado,
                        ]}
                      >
                        {participante.iniciais}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.nomePessoa,
                        selecionado && styles.nomePessoaSelecionado,
                      ]}
                    >
                      {participante.nome}
                    </Text>

                    <View
                      style={[
                        styles.checkbox,
                        selecionado && styles.checkboxSelecionado,
                      ]}
                    >
                      {selecionado && (
                        <Text style={styles.checkTexto}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* OBSERVAÇÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>
              Observação (opcional)
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.inputObservacao,
                campoFocado === "observacao" && styles.campoFocado,
              ]}
              placeholder="Adicione uma informação sobre a despesa..."
              placeholderTextColor={Cores.placeholder}
              value={observacao}
              onChangeText={setObservacao}
              onFocus={() => setCampoFocado("observacao")}
              onBlur={() =>
                setCampoFocado((campo) => campo === "observacao" ? null : campo)
              }
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* BOTÕES */}

          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && { opacity: 0.6 }]}
            onPress={salvarDespesa}
            disabled={salvando}
            activeOpacity={0.85}
          >
            <Text style={styles.botaoSalvarTexto}>
              {salvando ? "Salvando..." : "Salvar despesa"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={voltarParaTelaAnterior}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoCancelarTexto}>
              Cancelar
            </Text>
          </TouchableOpacity>

          <View style={styles.espacoFinal} />
        </ScrollView>
      </KeyboardAvoidingView>
      {mostrarSeletorData && (
        <CalendarioData
          value={data}
          onClose={() => setMostrarSeletorData(false)}
          onSelectDate={selecionarData}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  /* CABEÇALHO */

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

  voltar: {
    fontSize: 32,
    color: Cores.texto,
    marginTop: -3,
  },

  headerTexto: {
    flex: 1,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: Cores.texto,
  },

  subtitulo: {
    fontSize: 12,
    color: Cores.textoSuave,
    marginTop: 4,
  },

  /* CARTÃO DE LEITURA DE RECIBO */

  cardIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.superficieVerde,
    borderWidth: 1,
    borderColor: Cores.bordaDestaque,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },

  iconeIA: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Cores.cartaoFundo,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  iconeIAText: {
    fontSize: 21,
  },

  iaTexto: {
    flex: 1,
  },

  iaTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 3,
  },

  iaSubtitulo: {
    fontSize: 10,
    color: Cores.textoSuave,
    lineHeight: 15,
  },

  seta: {
    fontSize: 25,
    color: Cores.textoPositivo,
    marginLeft: 8,
  },

  /* CAMPOS */

  campo: {
    marginBottom: 20,
  },

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
  campoFocado: { borderWidth: 2, borderColor: Cores.textoPositivo },
  seletorData: {
    height: 52,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  textoSeletorData: { fontSize: 14, color: Cores.texto },
  placeholderSeletorData: { color: Cores.placeholder },

  valorContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
  },

  simbolo: {
    fontSize: 14,
    color: Cores.texto,
    marginRight: 8,
  },

  inputValor: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: Cores.texto,
    borderRadius: 12,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  ajuda: {
    fontSize: 11,
    lineHeight: 17,
    color: Cores.textoSuave,
    marginTop: 7,
  },

  descricaoSecao: {
    fontSize: 11,
    color: Cores.textoSuave,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },

  categorias: {
    gap: 8,
    paddingRight: 10,
  },
  erroCategorias: { color: Cores.textoErroFormulario, fontSize: 12, marginTop: 6 },

  categoria: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  categoriaSelecionada: {
    backgroundColor: Cores.superficieVerdeSelecionada,
    borderColor: Cores.principal,
  },


  categoriaTexto: {
    fontSize: 11,
    color: Cores.textoSuave,
    fontWeight: "600",
  },

  categoriaTextoSelecionado: {
    color: Cores.texto,
  },

  /* PAGADOR E PARTICIPANTES */

  listaOpcoes: {
    gap: 8,
  },

  opcaoPessoa: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  opcaoPessoaSelecionada: {
    backgroundColor: Cores.superficieVerde,
    borderColor: Cores.principal,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Cores.superficieVerde,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  avatarSelecionado: {
    backgroundColor: Cores.principal,
  },

  avatarTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: Cores.textoSuave,
  },

  avatarTextoSelecionado: {
    color: Cores.textoSobrePrincipal,
  },

  nomePessoa: {
    flex: 1,
    fontSize: 13,
    color: Cores.textoSuave,
    fontWeight: "500",
  },

  nomePessoaSelecionado: {
    color: Cores.texto,
    fontWeight: "700",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelecionado: {
    borderColor: Cores.principal,
  },

  radioCentro: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Cores.principal,
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelecionado: {
    backgroundColor: Cores.principal,
    borderColor: Cores.principal,
  },

  checkTexto: {
    fontSize: 13,
    fontWeight: "800",
    color: Cores.textoSobreAcao,
  },

  /* OBSERVAÇÃO */

  inputObservacao: {
    minHeight: 100,
    paddingTop: 14,
    paddingBottom: 14,
  },

  /* BOTÕES */

  botaoSalvar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  botaoSalvarTexto: {
    color: Cores.textoSobreAcao,
    fontSize: 15,
    fontWeight: "800",
  },

  botaoCancelar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  botaoCancelarTexto: {
    color: Cores.textoSuave,
    fontSize: 14,
    fontWeight: "700",
  },

  espacoFinal: {
    height: 20,
  },
});
