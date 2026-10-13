
/**
 * WEPAY — NOVA DESPESA EM GRUPO
 *
 * Mesmo padrão visual de nova-despesa-pessoal.tsx,
 * com campos específicos para despesas compartilhadas.
 *
 * Observação: o formulário ainda utiliza participantes de demonstração.
 * A gravação definitiva depende da integração com a API Flask.
 */

import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

type TipoDivisao = "IGUAL" | "VALOR" | "PERCENTUAL";

type Participante = {
  id: string;
  nome: string;
  iniciais: string;
};

const CATEGORIAS = [
  { nome: "Alimentação", icone: "🍽️" },
  { nome: "Transporte", icone: "🚕" },
  { nome: "Casa", icone: "🏠" },
  { nome: "Lazer", icone: "🎮" },
  { nome: "Assinatura", icone: "🎬" },
  { nome: "Outros", icone: "📦" },
];

// Dados temporários para visualizar a tela.
// Posteriormente, buscar os membros reais do grupo pela API.
const PARTICIPANTES: Participante[] = [
  { id: "1", nome: "Você", iniciais: "VC" },
  { id: "2", nome: "Ana Oliveira", iniciais: "AO" },
  { id: "3", nome: "Pedro Santos", iniciais: "PS" },
  { id: "4", nome: "Mariana Costa", iniciais: "MC" },
];

function obterParametro(
  parametro: string | string[] | undefined
): string {
  if (Array.isArray(parametro)) {
    return parametro[0] ?? "";
  }

  return parametro ?? "";
}

function normalizarDataRecebida(data: string): string {
  // Converte AAAA-MM-DD para DD/MM/AAAA quando a data
  // chega preenchida pela leitura do recibo.
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }

  return data;
}

function converterValor(valor: string): number {
  const limpo = valor
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  if (!limpo) {
    return NaN;
  }

  let normalizado = limpo;

  // Exemplos:
  // 1.234,56 -> 1234.56
  // 123,45   -> 123.45
  // 123.45   -> 123.45
  if (limpo.includes(",") && limpo.includes(".")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (limpo.includes(",")) {
    normalizado = limpo.replace(",", ".");
  }

  return Number(normalizado);
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function validarData(data: string): boolean {
  const resultado = data.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!resultado) {
    return false;
  }

  const dia = Number(resultado[1]);
  const mes = Number(resultado[2]);
  const ano = Number(resultado[3]);

  const dataValidada = new Date(ano, mes - 1, dia);

  return (
    dataValidada.getFullYear() === ano &&
    dataValidada.getMonth() === mes - 1 &&
    dataValidada.getDate() === dia
  );
}

export default function NovaDespesaGrupo() {
  const params = useLocalSearchParams();

  const groupId = obterParametro(params.groupId);
  const nomeGrupo =
    obterParametro(params.grupoNome) || "Despesa compartilhada";

  // Dados básicos da despesa.
  const [descricao, setDescricao] = useState(() =>
    obterParametro(params.descricao)
  );

  const [valor, setValor] = useState(() =>
    obterParametro(params.valor)
  );

  const [data, setData] = useState(() =>
    normalizarDataRecebida(obterParametro(params.data))
  );

  const [categoria, setCategoria] = useState(() => {
    const categoriaRecebida = obterParametro(params.categoria);

    return CATEGORIAS.some(
      (item) => item.nome === categoriaRecebida
    )
      ? categoriaRecebida
      : "Alimentação";
  });

  const [observacao, setObservacao] = useState("");

  // Dados específicos do grupo.
  const [pagadorId, setPagadorId] = useState("1");

  const [participantesSelecionados, setParticipantesSelecionados] =
    useState<string[]>(["1", "2", "3", "4"]);

  const [tipoDivisao, setTipoDivisao] =
    useState<TipoDivisao>("IGUAL");

  const [valoresIndividuais, setValoresIndividuais] =
    useState<Record<string, string>>({});

  const [percentuaisIndividuais, setPercentuaisIndividuais] =
    useState<Record<string, string>>({});

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

  function distribuirIgualmente(
    valorTotal: number,
    quantidade: number
  ): number[] {
    if (quantidade <= 0) {
      return [];
    }

    const totalCentavos = Math.round(valorTotal * 100);
    const valorBase = Math.floor(totalCentavos / quantidade);
    const resto = totalCentavos % quantidade;

    return Array.from(
      { length: quantidade },
      (_, indice) =>
        (valorBase + (indice < resto ? 1 : 0)) / 100
    );
  }

  function distribuirPorPercentual(
    valorTotal: number,
    percentuais: number[]
  ): number[] {
    const totalCentavos = Math.round(valorTotal * 100);
    const parcelas = percentuais.map((percentual) => {
      const valorExato = (totalCentavos * percentual) / 100;
      const centavos = Math.floor(valorExato);

      return {
        centavos,
        fracao: valorExato - centavos,
      };
    });

    let centavosRestantes = totalCentavos - parcelas.reduce(
      (total, parcela) => total + parcela.centavos,
      0
    );

    const indicesPorFracao = parcelas
      .map((parcela, indice) => ({ indice, fracao: parcela.fracao }))
      .sort((a, b) => b.fracao - a.fracao);

    for (let indice = 0; centavosRestantes > 0; indice += 1) {
      parcelas[indicesPorFracao[indice % parcelas.length].indice].centavos += 1;
      centavosRestantes -= 1;
    }

    return parcelas.map((parcela) => parcela.centavos / 100);
  }

  function validarDivisao(valorNumerico: number): boolean {
    if (participantesSelecionados.length === 0) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um participante para dividir a despesa."
      );

      return false;
    }

    if (tipoDivisao === "VALOR") {
      const valores = participantesSelecionados.map((id) =>
        converterValor(valoresIndividuais[id] ?? "")
      );

      if (valores.some((item) => !Number.isFinite(item) || item < 0)) {
        Alert.alert(
          "Valores inválidos",
          "Informe um valor válido para cada participante."
        );

        return false;
      }

      const somaCentavos = valores.reduce(
        (soma, item) => soma + Math.round(item * 100),
        0
      );

      if (somaCentavos !== Math.round(valorNumerico * 100)) {
        Alert.alert(
          "Divisão não confere",
          "A soma dos valores individuais deve ser igual ao valor total da despesa."
        );

        return false;
      }
    }

    if (tipoDivisao === "PERCENTUAL") {
      const percentuais = participantesSelecionados.map((id) =>
        Number(
          (percentuaisIndividuais[id] ?? "").replace(",", ".")
        )
      );

      if (
        percentuais.some(
          (item) => !Number.isFinite(item) || item < 0 || item > 100
        )
      ) {
        Alert.alert(
          "Percentuais inválidos",
          "Informe percentuais entre 0 e 100 para cada participante."
        );

        return false;
      }

      const soma = percentuais.reduce(
        (total, item) => total + item,
        0
      );

      if (Math.abs(soma - 100) > 0.01) {
        Alert.alert(
          "Divisão não confere",
          "A soma dos percentuais de todos os participantes precisa ser 100%."
        );

        return false;
      }
    }

    return true;
  }

  function salvarDespesa() {
    const descricaoLimpa = descricao.trim();
    const valorNumerico = converterValor(valor);
    const dataLimpa = data.trim();

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

    if (!validarData(dataLimpa)) {
      Alert.alert(
        "Data inválida",
        "Informe uma data válida no formato DD/MM/AAAA."
      );

      return;
    }

    if (!validarDivisao(valorNumerico)) {
      return;
    }

    let divisaoCalculada: {
      participanteId: string;
      valor: number;
    }[] = [];

    if (tipoDivisao === "IGUAL") {
      const valoresDivididos = distribuirIgualmente(
        valorNumerico,
        participantesSelecionados.length
      );

      divisaoCalculada = participantesSelecionados.map(
        (participanteId, indice) => ({
          participanteId,
          valor: valoresDivididos[indice],
        })
      );
    }

    if (tipoDivisao === "VALOR") {
      divisaoCalculada = participantesSelecionados.map(
        (participanteId) => ({
          participanteId,
          valor: converterValor(
            valoresIndividuais[participanteId] ?? ""
          ),
        })
      );
    }

    if (tipoDivisao === "PERCENTUAL") {
      const percentuais = participantesSelecionados.map((participanteId) =>
        Number(
          (percentuaisIndividuais[participanteId] ?? "0").replace(",", ".")
        )
      );
      const valoresDivididos = distribuirPorPercentual(
        valorNumerico,
        percentuais
      );

      divisaoCalculada = participantesSelecionados.map(
        (participanteId, indice) => ({
          participanteId,
          valor: valoresDivididos[indice],
        })
      );
    }

    // Demonstração local: os dados aparecem no console,
    // mas ainda não são enviados nem gravados no MySQL.
    console.log("Nova despesa em grupo:", {
      grupoId: groupId,
      descricao: descricaoLimpa,
      valor: valorNumerico,
      data: dataLimpa,
      categoria,
      pagadorId,
      participantes: participantesSelecionados,
      tipoDivisao,
      divisaoCalculada,
      observacao: observacao.trim(),
    });

    Alert.alert(
      "Formulário validado",
      "Os dados da despesa estão preenchidos corretamente. A gravação definitiva será habilitada quando o formulário estiver conectado à API Flask.",
      [
        {
          text: "Voltar",
          onPress: voltarParaTelaAnterior,
        },
      ]
    );
  }

  const valorNumerico = converterValor(valor);

  const valorPorPessoa =
    Number.isFinite(valorNumerico) &&
    valorNumerico > 0 &&
    participantesSelecionados.length > 0
      ? valorNumerico / participantesSelecionados.length
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

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
              style={styles.input}
              placeholder="Ex.: Mercado, jantar, hospedagem"
              placeholderTextColor="#8AA69E"
              value={descricao}
              onChangeText={setDescricao}
              autoCapitalize="sentences"
              maxLength={120}
            />
          </View>

          {/* VALOR */}

          <View style={styles.campo}>
            <Text style={styles.label}>Valor total</Text>

            <View style={styles.valorContainer}>
              <Text style={styles.simbolo}>R$</Text>

              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor="#8AA69E"
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
              />
            </View>

            {tipoDivisao === "IGUAL" &&
              valorNumerico > 0 &&
              participantesSelecionados.length > 0 && (
                <Text style={styles.ajuda}>
                  Divisão igual estimada:{" "}
                  {formatarMoeda(valorPorPessoa)} por pessoa.
                </Text>
              )}
          </View>

          {/* DATA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>

            <TextInput
              style={styles.input}
              placeholder="Ex.: 10/09/2026"
              placeholderTextColor="#8AA69E"
              value={data}
              onChangeText={setData}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>

          {/* CATEGORIA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categorias}
            >
              {CATEGORIAS.map((item) => {
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
                    <Text style={styles.categoriaIcone}>
                      {item.icone}
                    </Text>

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
          </View>

          {/* QUEM PAGOU */}

          <View style={styles.campo}>
            <Text style={styles.label}>Quem pagou?</Text>

            <Text style={styles.descricaoSecao}>
              Selecione quem realizou o pagamento.
            </Text>

            <View style={styles.listaOpcoes}>
              {PARTICIPANTES.map((participante) => {
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
              {PARTICIPANTES.map((participante) => {
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

          {/* TIPO DE DIVISÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>Como dividir o valor?</Text>

            <View style={styles.divisoes}>
              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "IGUAL" && styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("IGUAL")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>⚖️</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "IGUAL" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Igual
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Partes iguais
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "VALOR" && styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("VALOR")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>💵</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "VALOR" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Por valor
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Valor por pessoa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "PERCENTUAL" &&
                    styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("PERCENTUAL")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>📊</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "PERCENTUAL" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Por %
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Percentual
                </Text>
              </TouchableOpacity>
            </View>

            {/* VALORES INDIVIDUAIS */}

            {tipoDivisao === "VALOR" &&
              participantesSelecionados.length > 0 && (
                <View style={styles.detalhesDivisao}>
                  <Text style={styles.detalhesTitulo}>
                    Valor de cada participante
                  </Text>

                  {PARTICIPANTES.filter((item) =>
                    participantesSelecionados.includes(item.id)
                  ).map((participante) => (
                    <View
                      key={participante.id}
                      style={styles.linhaDivisao}
                    >
                      <Text style={styles.nomeLinha}>
                        {participante.nome}
                      </Text>

                      <View style={styles.valorIndividual}>
                        <Text style={styles.simboloPequeno}>R$</Text>

                        <TextInput
                          style={styles.inputIndividual}
                          placeholder="0,00"
                          placeholderTextColor="#8AA69E"
                          value={
                            valoresIndividuais[participante.id] ?? ""
                          }
                          onChangeText={(texto) =>
                            setValoresIndividuais((atuais) => ({
                              ...atuais,
                              [participante.id]: texto,
                            }))
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

            {/* PERCENTUAIS INDIVIDUAIS */}

            {tipoDivisao === "PERCENTUAL" &&
              participantesSelecionados.length > 0 && (
                <View style={styles.detalhesDivisao}>
                  <Text style={styles.detalhesTitulo}>
                    Percentual de cada participante
                  </Text>

                  {PARTICIPANTES.filter((item) =>
                    participantesSelecionados.includes(item.id)
                  ).map((participante) => (
                    <View
                      key={participante.id}
                      style={styles.linhaDivisao}
                    >
                      <Text style={styles.nomeLinha}>
                        {participante.nome}
                      </Text>

                      <View style={styles.percentualIndividual}>
                        <TextInput
                          style={styles.inputPercentual}
                          placeholder="0"
                          placeholderTextColor="#8AA69E"
                          value={
                            percentuaisIndividuais[participante.id] ?? ""
                          }
                          onChangeText={(texto) =>
                            setPercentuaisIndividuais((atuais) => ({
                              ...atuais,
                              [participante.id]: texto,
                            }))
                          }
                          keyboardType="decimal-pad"
                        />

                        <Text style={styles.simboloPercentual}>%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
          </View>

          {/* OBSERVAÇÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>
              Observação (opcional)
            </Text>

            <TextInput
              style={[styles.input, styles.inputObservacao]}
              placeholder="Adicione uma informação sobre a despesa..."
              placeholderTextColor="#8AA69E"
              value={observacao}
              onChangeText={setObservacao}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* BOTÕES */}

          <TouchableOpacity
            style={styles.botaoSalvar}
            onPress={salvarDespesa}
            activeOpacity={0.85}
          >
            <Text style={styles.botaoSalvarTexto}>
              Salvar despesa
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  voltar: {
    fontSize: 32,
    color: "#0B3B33",
    marginTop: -3,
  },

  headerTexto: {
    flex: 1,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3B33",
  },

  subtitulo: {
    fontSize: 12,
    color: "#6B8F86",
    marginTop: 4,
  },

  /* CARTÃO DE LEITURA DE RECIBO */

  cardIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F9F2",
    borderWidth: 1,
    borderColor: "#C9EFE1",
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },

  iconeIA: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
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
    color: "#0B3B33",
    marginBottom: 3,
  },

  iaSubtitulo: {
    fontSize: 10,
    color: "#6B8F86",
    lineHeight: 15,
  },

  seta: {
    fontSize: 25,
    color: "#00A17A",
    marginLeft: 8,
  },

  /* CAMPOS */

  campo: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B3B33",
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 14,
    color: "#0B3B33",
  },

  valorContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 15,
  },

  simbolo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3B33",
    marginRight: 8,
  },

  inputValor: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    color: "#0B3B33",
  },

  ajuda: {
    fontSize: 11,
    lineHeight: 17,
    color: "#6B8F86",
    marginTop: 7,
  },

  descricaoSecao: {
    fontSize: 11,
    color: "#6B8F86",
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },

  categorias: {
    gap: 8,
    paddingRight: 10,
  },

  categoria: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  categoriaSelecionada: {
    backgroundColor: "#DDF7EE",
    borderColor: "#00C896",
  },

  categoriaIcone: {
    fontSize: 15,
    marginRight: 5,
  },

  categoriaTexto: {
    fontSize: 11,
    color: "#6B8F86",
    fontWeight: "600",
  },

  categoriaTextoSelecionado: {
    color: "#0B3B33",
  },

  /* PAGADOR E PARTICIPANTES */

  listaOpcoes: {
    gap: 8,
  },

  opcaoPessoa: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  opcaoPessoaSelecionada: {
    backgroundColor: "#F1FBF7",
    borderColor: "#00C896",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF7F3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  avatarSelecionado: {
    backgroundColor: "#00C896",
  },

  avatarTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B8F86",
  },

  avatarTextoSelecionado: {
    color: "#0B3B33",
  },

  nomePessoa: {
    flex: 1,
    fontSize: 13,
    color: "#6B8F86",
    fontWeight: "500",
  },

  nomePessoaSelecionado: {
    color: "#0B3B33",
    fontWeight: "700",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#B7CEC5",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelecionado: {
    borderColor: "#00C896",
  },

  radioCentro: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00C896",
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#B7CEC5",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelecionado: {
    backgroundColor: "#00C896",
    borderColor: "#00C896",
  },

  checkTexto: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* TIPOS DE DIVISÃO */

  divisoes: {
    flexDirection: "row",
    gap: 8,
  },

  divisao: {
    flex: 1,
    minHeight: 108,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  divisaoSelecionada: {
    backgroundColor: "#DDF7EE",
    borderColor: "#00C896",
  },

  divisaoIcone: {
    fontSize: 21,
    marginBottom: 7,
  },

  divisaoTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B8F86",
    textAlign: "center",
  },

  divisaoTituloSelecionado: {
    color: "#0B3B33",
  },

  divisaoDescricao: {
    fontSize: 9,
    color: "#6B8F86",
    marginTop: 5,
    textAlign: "center",
  },

  detalhesDivisao: {
    marginTop: 14,
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
  },

  detalhesTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 12,
  },

  linhaDivisao: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F6F3",
    paddingVertical: 5,
  },

  nomeLinha: {
    flex: 1,
    fontSize: 12,
    color: "#0B3B33",
    paddingRight: 8,
  },

  valorIndividual: {
    width: 112,
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 10,
    paddingHorizontal: 8,
  },

  simboloPequeno: {
    color: "#6B8F86",
    fontSize: 10,
    fontWeight: "700",
    marginRight: 4,
  },

  inputIndividual: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#0B3B33",
    textAlign: "right",
  },

  percentualIndividual: {
    width: 78,
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 10,
    paddingHorizontal: 8,
  },

  inputPercentual: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#0B3B33",
    textAlign: "right",
  },

  simboloPercentual: {
    color: "#6B8F86",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
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
    backgroundColor: "#00C896",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  botaoSalvarTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  botaoCancelar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  botaoCancelarTexto: {
    color: "#6B8F86",
    fontSize: 14,
    fontWeight: "700",
  },

  espacoFinal: {
    height: 20,
  },
});
