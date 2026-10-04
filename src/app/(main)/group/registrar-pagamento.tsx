/*
 * ============================================================
 * WEPAY - REGISTRAR PAGAMENTO
 * ============================================================
 *
 * Esta tela permite registrar o pagamento de um saldo
 * pendente dentro de um grupo.
 *
 * Fluxo:
 *
 * Saldos
 *    ↓
 * Participante
 *    ↓
 * Registrar pagamento
 *    ↓
 * Informar valor
 *    ↓
 * Confirmar pagamento
 *    ↓
 * Voltar para Saldos
 *
 *
 * DADOS RECEBIDOS PELA ROTA
 * ------------------------------------------------------------
 *
 * participanteId
 * participanteNome
 * valor
 * groupId
 *
 *
 * Nesta etapa os dados ainda são MOCKS.
 *
 * Futuramente:
 *
 * React Native
 *      ↓
 * services/api.ts
 *      ↓
 * Flask
 *      ↓
 * MySQL
 */


/* ============================================================
   IMPORTS
============================================================ */

import React, { useState } from "react";

import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { Cores } from "../../../constants/Cores";


/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */

export default function RegistrarPagamento() {

  /**
   * ==========================================================
   * PARÂMETROS DA ROTA
   * ==========================================================
   *
   * Exemplo de navegação:
   *
   * router.push({
   *   pathname:
   *     "/(main)/group/registrar-pagamento",
   *
   *   params: {
   *     participanteId: "2",
   *     participanteNome: "Bruno Lima",
   *     valor: "30",
   *     groupId: "1",
   *   },
   * });
   */

  const {
    participanteId,
    participanteNome,
    valor,
    groupId,
  } = useLocalSearchParams<{
    participanteId?: string;
    participanteNome?: string;
    valor?: string;
    groupId?: string;
  }>();


  /**
   * ==========================================================
   * DADOS INICIAIS
   * ==========================================================
   *
   * Caso a tela seja aberta diretamente durante o
   * desenvolvimento, usamos valores de demonstração.
   */

  const nomePessoa =
    participanteNome || "Bruno Lima";

  const valorPendente =
    Number(
      String(valor || "30").replace(",", ".")
    ) || 30;


  /**
   * ==========================================================
   * ESTADOS DO FORMULÁRIO
   * ==========================================================
   */

  const [valorPagamento, setValorPagamento] =
    useState(
      valorPendente
        .toFixed(2)
        .replace(".", ",")
    );

  const [dataPagamento, setDataPagamento] =
    useState("");

  const [metodoPagamento, setMetodoPagamento] =
    useState("Pix");

  const [observacao, setObservacao] =
    useState("");

  const [carregando, setCarregando] =
    useState(false);


  /**
   * ==========================================================
   * MÉTODOS DE PAGAMENTO
   * ==========================================================
   */

  const metodos = [
    "Pix",
    "Dinheiro",
    "Transferência",
    "Outro",
  ];


  /**
   * ==========================================================
   * CONVERTER VALOR
   * ==========================================================
   *
   * Aceita:
   *
   * 30
   * 30,50
   * 30.50
   * 1.000,50
   *
   * e transforma em número.
   */

  function converterParaNumero(
    texto: string
  ): number {

    const valorLimpo = texto
      .trim()
      .replace(/\s/g, "");

    if (!valorLimpo) {
      return 0;
    }


    /**
     * Caso brasileiro:
     *
     * 1.000,50
     *
     * remove o ponto
     * troca vírgula por ponto
     */

    if (
      valorLimpo.includes(",") &&
      valorLimpo.includes(".")
    ) {
      return (
        Number(
          valorLimpo
            .replace(/\./g, "")
            .replace(",", ".")
        ) || 0
      );
    }


    /**
     * Caso simples:
     *
     * 30,50
     */

    return (
      Number(
        valorLimpo.replace(",", ".")
      ) || 0
    );
  }


  /**
   * ==========================================================
   * FORMATAR MOEDA
   * ==========================================================
   */

  function formatarMoeda(
    valorNumerico: number
  ): string {

    return valorNumerico.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }


  /**
   * ==========================================================
   * REGISTRAR PAGAMENTO
   * ==========================================================
   */

  function confirmarPagamento() {

    const valorNumerico =
      converterParaNumero(
        valorPagamento
      );


    /* --------------------------------------------------------
       VALIDAÇÃO DO VALOR
    --------------------------------------------------------- */

    if (valorNumerico <= 0) {

      Alert.alert(
        "Atenção",
        "Digite um valor de pagamento válido."
      );

      return;
    }


    /* --------------------------------------------------------
       NÃO PERMITIR PAGAMENTO MAIOR QUE O SALDO
    --------------------------------------------------------- */

    if (
      valorNumerico >
      valorPendente + 0.01
    ) {

      Alert.alert(
        "Atenção",
        `O pagamento não pode ser maior que o saldo pendente de ${formatarMoeda(
          valorPendente
        )}.`
      );

      return;
    }


    /* --------------------------------------------------------
       VALIDAÇÃO DA DATA
    --------------------------------------------------------- */

    if (dataPagamento.trim()) {

      const dataValida =
        /^\d{2}\/\d{2}\/\d{4}$/.test(
          dataPagamento.trim()
        );

      if (!dataValida) {

        Alert.alert(
          "Atenção",
          "Informe a data no formato DD/MM/AAAA."
        );

        return;
      }
    }


    /* --------------------------------------------------------
       EVITAR DUPLO CLIQUE
    --------------------------------------------------------- */

    if (carregando) {
      return;
    }


    setCarregando(true);


    /**
     * ========================================================
     * MOCK DO REGISTRO
     * ========================================================
     *
     * Futuramente substituir pelo services/api.ts.
     */

    const pagamento = {
      groupId,
      participanteId,
      participanteNome: nomePessoa,
      valor: valorNumerico,
      metodo: metodoPagamento,
      data: dataPagamento.trim() || "Hoje",
      observacao: observacao.trim(),
    };


    /*
     * Durante a fase de frontend,
     * mostramos no console somente os dados
     * necessários da operação.
     *
     * NUNCA registrar senhas ou dados sensíveis.
     */

    console.log(
      "Pagamento registrado:",
      pagamento
    );


    /**
     * Simulação de processamento.
     */
    setTimeout(() => {

      setCarregando(false);


      /**
       * Verifica se foi uma quitação completa
       * ou apenas um pagamento parcial.
       */

      const pagamentoCompleto =
        Math.abs(
          valorNumerico -
          valorPendente
        ) < 0.01;


      Alert.alert(
        pagamentoCompleto
          ? "Pagamento registrado"
          : "Pagamento parcial registrado",

        pagamentoCompleto
          ? `O saldo com ${nomePessoa} foi quitado com sucesso.`
          : `O pagamento de ${formatarMoeda(
              valorNumerico
            )} foi registrado.`,

        [
          {
            text: "OK",

            onPress: () => {

              /**
               * Volta para a tela anterior.
               *
               * Futuramente o backend/API
               * já terá atualizado os saldos.
               */

              router.back();
            },
          },
        ]
      );

    }, 700);
  }


  /**
   * ==========================================================
   * INTERFACE
   * ==========================================================
   */

  return (

    <SafeAreaView style={styles.safeArea}>

      <StatusBar
        barStyle="dark-content"
      />


      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >

        <ScrollView
          contentContainerStyle={
            styles.conteudo
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >


          {/* ==================================================
              CABEÇALHO
          =================================================== */}

          <View style={styles.header}>

            {/* Botão voltar */}

            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >

              <Text style={styles.iconeVoltar}>
                ‹
              </Text>

            </TouchableOpacity>


            {/* Título */}

            <Text style={styles.tituloHeader}>
              Registrar pagamento
            </Text>


            {/* Espaço para centralização */}

            <View style={styles.espacoHeader} />

          </View>


          {/* ==================================================
              CARD DO PARTICIPANTE
          =================================================== */}

          <View style={styles.cardPessoa}>

            {/* Avatar */}

            <View style={styles.avatar}>

              <Text style={styles.avatarTexto}>
                {nomePessoa
                  .substring(0, 1)
                  .toUpperCase()}
              </Text>

            </View>


            {/* Informações */}

            <View style={styles.infoPessoa}>

              <Text style={styles.labelPessoa}>
                Pagamento para
              </Text>

              <Text style={styles.nomePessoa}>
                {nomePessoa}
              </Text>

            </View>

          </View>


          {/* ==================================================
              SALDO PENDENTE
          =================================================== */}

          <View style={styles.cardSaldo}>

            <Text style={styles.saldoLabel}>
              Saldo pendente
            </Text>


            <Text style={styles.saldoValor}>
              {formatarMoeda(
                valorPendente
              )}
            </Text>


            <Text style={styles.saldoDescricao}>
              Este é o valor que você ainda precisa
              pagar neste grupo.
            </Text>

          </View>


          {/* ==================================================
              VALOR DO PAGAMENTO
          =================================================== */}

          <View style={styles.section}>

            <Text style={styles.label}>
              Valor do pagamento
            </Text>


            <View style={styles.valorContainer}>

              <Text style={styles.moeda}>
                R$
              </Text>


              <TextInput
                style={styles.valorInput}
                value={valorPagamento}
                onChangeText={
                  setValorPagamento
                }
                placeholder="0,00"
                placeholderTextColor={
                  Cores.textoSuave
                }
                keyboardType="decimal-pad"
                selectTextOnFocus
              />

            </View>


            <Text style={styles.helper}>
              Máximo permitido:{" "}
              {formatarMoeda(
                valorPendente
              )}
            </Text>

          </View>


          {/* ==================================================
              DATA
          =================================================== */}

          <View style={styles.section}>

            <Text style={styles.label}>
              Data do pagamento
            </Text>


            <TextInput
              style={styles.input}
              value={dataPagamento}
              onChangeText={
                setDataPagamento
              }
              placeholder="DD/MM/AAAA"
              placeholderTextColor={
                Cores.textoSuave
              }
              keyboardType="number-pad"
              maxLength={10}
            />


            <Text style={styles.helper}>
              Opcional. Deixe vazio para usar a data atual.
            </Text>

          </View>


          {/* ==================================================
              MÉTODO DE PAGAMENTO
          =================================================== */}

          <View style={styles.section}>

            <Text style={styles.label}>
              Método de pagamento
            </Text>


            <View style={styles.metodosContainer}>

              {metodos.map(
                (metodo) => {

                  const ativo =
                    metodoPagamento ===
                    metodo;


                  return (

                    <TouchableOpacity
                      key={metodo}
                      style={[
                        styles.metodo,
                        ativo &&
                          styles.metodoAtivo,
                      ]}
                      onPress={() =>
                        setMetodoPagamento(
                          metodo
                        )
                      }
                      activeOpacity={0.8}
                    >

                      <Text
                        style={[
                          styles.metodoTexto,
                          ativo &&
                            styles.metodoTextoAtivo,
                        ]}
                      >
                        {metodo}
                      </Text>

                    </TouchableOpacity>

                  );
                }
              )}

            </View>

          </View>


          {/* ==================================================
              OBSERVAÇÃO
          =================================================== */}

          <View style={styles.section}>

            <Text style={styles.label}>
              Observação
            </Text>


            <TextInput
              style={[
                styles.input,
                styles.inputObservacao,
              ]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex.: Pagamento realizado via Pix"
              placeholderTextColor={
                Cores.textoSuave
              }
              multiline
              textAlignVertical="top"
            />

          </View>


          {/* ==================================================
              RESUMO
          =================================================== */}

          <View style={styles.resumo}>

            <View style={styles.resumoRow}>

              <Text style={styles.resumoLabel}>
                Participante
              </Text>

              <Text style={styles.resumoValorTexto}>
                {nomePessoa}
              </Text>

            </View>


            <View style={styles.resumoRow}>

              <Text style={styles.resumoLabel}>
                Valor
              </Text>

              <Text style={styles.resumoValor}>
                {formatarMoeda(
                  converterParaNumero(
                    valorPagamento
                  )
                )}
              </Text>

            </View>


            <View style={styles.resumoRow}>

              <Text style={styles.resumoLabel}>
                Método
              </Text>

              <Text style={styles.resumoValorTexto}>
                {metodoPagamento}
              </Text>

            </View>

          </View>


          {/* ==================================================
              BOTÃO CONFIRMAR
          =================================================== */}

          <TouchableOpacity
            style={[
              styles.botaoConfirmar,

              carregando &&
                styles.botaoDesabilitado,
            ]}
            onPress={
              confirmarPagamento
            }
            disabled={carregando}
            activeOpacity={0.8}
          >

            <Text style={styles.textoBotaoConfirmar}>
              {carregando
                ? "Registrando pagamento..."
                : "Confirmar pagamento"}
            </Text>

          </TouchableOpacity>


          {/* ==================================================
              CANCELAR
          =================================================== */}

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={() => router.back()}
            disabled={carregando}
          >

            <Text style={styles.textoCancelar}>
              Cancelar
            </Text>

          </TouchableOpacity>


        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}


/* ============================================================
   ESTILOS
============================================================ */

const styles = StyleSheet.create({

  /* ==========================================================
     BASE
  ========================================================== */

  safeArea: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  keyboard: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },


  /* ==========================================================
     CABEÇALHO
  ========================================================== */

  header: {
    height: 65,

    flexDirection: "row",

    alignItems: "center",

    justifyContent:
      "space-between",
  },

  botaoVoltar: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor:
      Cores.branco,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    justifyContent:
      "center",

    alignItems:
      "center",
  },

  iconeVoltar: {
    color: Cores.texto,

    fontSize: 32,

    fontWeight: "300",

    lineHeight: 34,
  },

  tituloHeader: {
    color: Cores.texto,

    fontSize: 17,

    fontWeight: "700",
  },

  espacoHeader: {
    width: 42,
  },


  /* ==========================================================
     PARTICIPANTE
  ========================================================== */

  cardPessoa: {
    flexDirection: "row",

    alignItems: "center",

    backgroundColor:
      Cores.branco,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    borderRadius: 18,

    padding: 16,

    marginTop: 15,
  },

  avatar: {
    width: 54,
    height: 54,

    borderRadius: 18,

    backgroundColor:
      Cores.principal,

    justifyContent:
      "center",

    alignItems:
      "center",
  },

  avatarTexto: {
    color: Cores.texto,

    fontSize: 17,

    fontWeight: "700",
  },

  infoPessoa: {
    flex: 1,

    marginLeft: 12,
  },

  labelPessoa: {
    color: Cores.textoSuave,

    fontSize: 11,
  },

  nomePessoa: {
    color: Cores.texto,

    fontSize: 17,

    fontWeight: "700",

    marginTop: 4,
  },


  /* ==========================================================
     SALDO
  ========================================================== */

  cardSaldo: {
    backgroundColor:
      Cores.texto,

    borderRadius: 18,

    padding: 19,

    marginTop: 14,
  },

  saldoLabel: {
    color: "#BFE0D6",

    fontSize: 11,

    fontWeight: "600",
  },

  saldoValor: {
    color: Cores.branco,

    fontSize: 27,

    fontWeight: "700",

    marginTop: 5,
  },

  saldoDescricao: {
    color: "#BFE0D6",

    fontSize: 12,

    lineHeight: 18,

    marginTop: 8,
  },


  /* ==========================================================
     SEÇÕES
  ========================================================== */

  section: {
    marginTop: 22,
  },

  label: {
    color: Cores.texto,

    fontSize: 13,

    fontWeight: "700",

    marginBottom: 8,
  },

  helper: {
    color: Cores.textoSuave,

    fontSize: 11,

    lineHeight: 16,

    marginTop: 6,
  },


  /* ==========================================================
     INPUT
  ========================================================== */

  input: {
    height: 52,

    backgroundColor:
      Cores.campo,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    borderRadius: 12,

    paddingHorizontal: 15,

    color: Cores.texto,

    fontSize: 14,
  },


  /* ==========================================================
     VALOR
  ========================================================== */

  valorContainer: {
    height: 58,

    backgroundColor:
      Cores.campo,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    borderRadius: 14,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 15,
  },

  moeda: {
    color: Cores.texto,

    fontSize: 17,

    fontWeight: "700",

    marginRight: 8,
  },

  valorInput: {
    flex: 1,

    color: Cores.texto,

    fontSize: 20,

    fontWeight: "600",
  },


  /* ==========================================================
     MÉTODOS
  ========================================================== */

  metodosContainer: {
    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,
  },

  metodo: {
    backgroundColor:
      Cores.campo,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    borderRadius: 20,

    paddingHorizontal: 14,

    paddingVertical: 10,
  },

  metodoAtivo: {
    backgroundColor:
      Cores.texto,

    borderColor:
      Cores.texto,
  },

  metodoTexto: {
    color: Cores.textoSuave,

    fontSize: 12,

    fontWeight: "600",
  },

  metodoTextoAtivo: {
    color: Cores.branco,
  },


  /* ==========================================================
     OBSERVAÇÃO
  ========================================================== */

  inputObservacao: {
    height: 95,

    paddingTop: 14,
  },


  /* ==========================================================
     RESUMO
  ========================================================== */

  resumo: {
    backgroundColor:
      Cores.branco,

    borderWidth: 1,

    borderColor:
      Cores.borda,

    borderRadius: 16,

    paddingHorizontal: 16,

    marginTop: 24,
  },

  resumoRow: {
    minHeight: 52,

    flexDirection: "row",

    alignItems: "center",

    justifyContent:
      "space-between",

    borderBottomWidth: 1,

    borderBottomColor:
      Cores.borda,
  },

  resumoLabel: {
    color: Cores.textoSuave,

    fontSize: 12,
  },

  resumoValorTexto: {
    color: Cores.texto,

    fontSize: 12,

    fontWeight: "600",
  },

  resumoValor: {
    color: Cores.principalEscuro,

    fontSize: 14,

    fontWeight: "700",
  },


  /* ==========================================================
     BOTÃO CONFIRMAR
  ========================================================== */

  botaoConfirmar: {
    height: 52,

    backgroundColor:
      Cores.principal,

    borderRadius: 12,

    justifyContent:
      "center",

    alignItems:
      "center",

    marginTop: 25,
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  textoBotaoConfirmar: {
    color: Cores.texto,

    fontSize: 15,

    fontWeight: "700",
  },


  /* ==========================================================
     CANCELAR
  ========================================================== */

  botaoCancelar: {
    alignItems:
      "center",

    paddingVertical: 16,
  },

  textoCancelar: {
    color: Cores.textoSuave,

    fontSize: 13,

    fontWeight: "600",
  },

});