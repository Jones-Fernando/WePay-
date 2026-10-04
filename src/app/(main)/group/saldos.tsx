/**
 * ============================================================
 * WEPAY - SALDOS DO GRUPO
 * ============================================================
 *
 * Esta tela mostra:
 *
 * - o saldo geral do usuário dentro do grupo;
 * - quem o usuário precisa pagar;
 * - valores individuais;
 * - situação de cada saldo.
 *
 *
 * EXEMPLO:
 *
 * Você deve, no total
 * R$ 45,00
 *
 * Bruno Lima
 * você deve pagar
 * R$ 30,00
 *
 * Laura Nunes
 * você deve pagar
 * R$ 15,00
 *
 * Rafael Dias
 * quitado
 * R$ 0,00
 *
 *
 * Os valores abaixo são MOCKS para o frontend.
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

import React from "react";

import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from "react-native";

import { router } from "expo-router";

import { Cores } from "../../../constants/Cores";


/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */

export default function SaldosGrupo() {

  /**
   * ==========================================================
   * DADOS MOCKADOS
   * ==========================================================
   *
   * Estes valores seguem a referência visual do projeto.
   */

  const participantes = [
    {
      id: "1",

      nome: "Bruno Lima",

      inicial: "B",

      /**
       * Valor que o usuário precisa pagar.
       */
      valor: 30,

      status: "você deve pagar",

      quitado: false,

      corAvatar: "#4C8DFF",
    },

    {
      id: "2",

      nome: "Laura Nunes",

      inicial: "L",

      valor: 15,

      status: "você deve pagar",

      quitado: false,

      corAvatar: "#B18CFF",
    },

    {
      id: "3",

      nome: "Rafael Dias",

      inicial: "R",

      valor: 0,

      status: "quitado",

      quitado: true,

      corAvatar: "#FFB454",
    },
  ];


  /**
   * ==========================================================
   * TOTAL A PAGAR
   * ==========================================================
   *
   * Soma somente valores que ainda não foram quitados.
   *
   * IMPORTANTE:
   *
   * Esse cálculo é apenas para o mock/frontend.
   *
   * O saldo oficial deverá ser calculado pelo backend.
   */

  const totalDevido = participantes
    .filter(
      (pessoa) => !pessoa.quitado
    )
    .reduce(
      (total, pessoa) =>
        total + pessoa.valor,
      0
    );


  /**
   * ==========================================================
   * FORMATAÇÃO DE MOEDA
   * ==========================================================
   */

  function formatarMoeda(valor: number) {

    return valor.toLocaleString(
      "pt-BR",
      {
        style: "currency",

        currency: "BRL",
      }
    );

  }


  /**
   * ==========================================================
   * NAVEGAÇÃO ENTRE ABAS
   * ==========================================================
   */

  function selecionarAba(aba: string) {

    if (aba === "despesas") {

      router.replace(
        "/(main)/group/despesas-grupo"
      );

      return;
    }


    if (aba === "participantes") {

      router.replace(
        "/(main)/group/participantes"
      );

      return;
    }

  }


  /**
   * ==========================================================
   * DETALHES DE UM SALDO
   * ==========================================================
   *
   * No futuro esta função poderá abrir:
   *
   * - histórico;
   * - comprovante;
   * - marcar pagamento;
   * - desfazer pagamento.
   */

  function abrirSaldo(
    participanteId: string,
    nome: string,
    valor: number,
    quitado: boolean
  ) {

    if (quitado) {

      Alert.alert(
        nome,
        "Este saldo já está quitado."
      );

      return;
    }


    router.push({
      pathname: "/(main)/group/registrar-pagamento",
      params: {
        participanteId,
        participanteNome: nome,
        valor: String(valor),
        groupId: "1",
      },
    });

  }


  /**
   * ==========================================================
   * INTERFACE
   * ========================================================== */

  return (

    <SafeAreaView style={styles.safeArea}>

      {/* ======================================================
          STATUS BAR
      ======================================================= */}

      <StatusBar
        barStyle="dark-content"
      />


      {/* ======================================================
          CABEÇALHO
      ======================================================= */}

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


        {/* Informações do grupo */}
        <View style={styles.headerTextos}>

          <Text style={styles.tituloPequeno}>
            Saldos ·
          </Text>

          <Text style={styles.titulo}>
            Apê Rep. 302
          </Text>

        </View>


        {/* Menu */}
        <TouchableOpacity
          style={styles.botaoMenu}
          onPress={() =>
            Alert.alert(
              "Opções",
              "Mais opções dos saldos."
            )
          }
          activeOpacity={0.7}
        >

          <Text style={styles.menuText}>
            •••
          </Text>

        </TouchableOpacity>

      </View>


      {/* ======================================================
          ABAS
      ======================================================= */}

      <View style={styles.abas}>

        {/* Despesas */}
        <TouchableOpacity
          style={styles.aba}
          onPress={() =>
            selecionarAba("despesas")
          }
          activeOpacity={0.8}
        >

          <Text style={styles.textoAba}>
            Despesas
          </Text>

        </TouchableOpacity>


        {/* Participantes */}
        <TouchableOpacity
          style={styles.aba}
          onPress={() =>
            selecionarAba("participantes")
          }
          activeOpacity={0.8}
        >

          <Text style={styles.textoAba}>
            Participantes
          </Text>

        </TouchableOpacity>


        {/* Saldos ativo */}
        <TouchableOpacity
          style={[
            styles.aba,
            styles.abaAtiva,
          ]}
          activeOpacity={0.8}
        >

          <Text
            style={[
              styles.textoAba,
              styles.textoAbaAtiva,
            ]}
          >
            Saldos
          </Text>

        </TouchableOpacity>

      </View>


      {/* ======================================================
          CONTEÚDO
      ======================================================= */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >


        {/* ====================================================
            CARTÃO PRINCIPAL
        ===================================================== */}

        <View style={styles.saldoPrincipal}>

          {/* Pequeno texto */}
          <Text style={styles.saldoPrincipalLabel}>
            Você deve, no total
          </Text>


          {/* Valor */}
          <Text style={styles.saldoPrincipalValor}>
            {formatarMoeda(totalDevido)}
          </Text>


          {/* Descrição */}
          <Text style={styles.saldoPrincipalDescricao}>
            Valor pendente neste grupo
          </Text>

        </View>


        {/* ====================================================
            TÍTULO
        ===================================================== */}

        <View style={styles.listaHeader}>

          <Text style={styles.listaTitulo}>
            Saldos por participante
          </Text>

          <Text style={styles.listaQuantidade}>
            {participantes.length} pessoas
          </Text>

        </View>


        {/* ====================================================
            PARTICIPANTES
        ===================================================== */}

        <View style={styles.lista}>

          {participantes.map(
            (pessoa, index) => (

              <View key={pessoa.id}>

                <TouchableOpacity
                  style={styles.cardPessoa}
                  activeOpacity={0.8}
                  onPress={() =>
                    abrirSaldo(
                      pessoa.id,
                      pessoa.nome,
                      pessoa.valor,
                      pessoa.quitado
                    )
                  }
                >

                  {/* -------------------------------------------
                      AVATAR
                  -------------------------------------------- */}

                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor:
                          pessoa.corAvatar,
                      },
                    ]}
                  >

                    <Text style={styles.avatarTexto}>
                      {pessoa.inicial}
                    </Text>

                  </View>


                  {/* -------------------------------------------
                      INFORMAÇÕES
                  -------------------------------------------- */}

                  <View style={styles.pessoaInfo}>

                    <Text style={styles.pessoaNome}>
                      {pessoa.nome}
                    </Text>


                    <Text
                      style={[
                        styles.pessoaStatus,

                        pessoa.quitado
                          ? styles.statusQuitado
                          : styles.statusPagar,
                      ]}
                    >
                      {pessoa.status}
                    </Text>

                  </View>


                  {/* -------------------------------------------
                      VALOR
                  -------------------------------------------- */}

                  <View
                    style={[
                      styles.pill,

                      pessoa.quitado
                        ? styles.pillQuitado
                        : styles.pillPagar,
                    ]}
                  >

                    <Text
                      style={[
                        styles.pillTexto,

                        pessoa.quitado
                          ? styles.pillTextoQuitado
                          : styles.pillTextoPagar,
                      ]}
                    >
                      {formatarMoeda(
                        pessoa.valor
                      )}
                    </Text>

                  </View>

                </TouchableOpacity>


                {/* Divisor */}
                {index <
                  participantes.length - 1 && (

                  <View style={styles.divisor} />

                )}

              </View>

            )
          )}

        </View>


        {/* ====================================================
            EXPLICAÇÃO
        ===================================================== */}

        <View style={styles.infoCard}>

          <View style={styles.infoIcon}>

            <Text style={styles.infoIconText}>
              i
            </Text>

          </View>


          <Text style={styles.infoTexto}>

            Os saldos representam quanto cada participante
            deve pagar ou receber após a divisão das despesas
            do grupo.

          </Text>

        </View>


        <View style={styles.espacoFinal} />

      </ScrollView>

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


  scroll: {
    flex: 1,
  },


  conteudo: {
    paddingHorizontal: 20,

    paddingBottom: 35,
  },


  /* ==========================================================
     CABEÇALHO
  ========================================================== */

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

    backgroundColor: Cores.branco,

    justifyContent: "center",

    alignItems: "center",

    marginRight: 12,

    borderWidth: 1,

    borderColor: Cores.borda,
  },


  iconeVoltar: {
    fontSize: 32,

    color: Cores.texto,

    lineHeight: 34,

    marginTop: -3,
  },


  headerTextos: {
    flex: 1,
  },


  tituloPequeno: {
    fontSize: 13,

    color: Cores.textoSuave,

    marginBottom: 2,
  },


  titulo: {
    fontSize: 24,

    fontWeight: "700",

    color: Cores.texto,
  },


  botaoMenu: {
    width: 42,

    height: 42,

    borderRadius: 21,

    justifyContent: "center",

    alignItems: "center",
  },


  menuText: {
    fontSize: 20,

    fontWeight: "700",

    color: Cores.textoSuave,

    letterSpacing: 2,
  },


  /* ==========================================================
     ABAS
  ========================================================== */

  abas: {
    flexDirection: "row",

    marginHorizontal: 20,

    marginBottom: 18,

    padding: 4,

    borderRadius: 14,

    backgroundColor: "#EAF5F0",
  },


  aba: {
    flex: 1,

    paddingVertical: 11,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: 11,
  },


  abaAtiva: {
    backgroundColor: Cores.branco,
  },


  textoAba: {
    fontSize: 13,

    fontWeight: "600",

    color: Cores.textoSuave,
  },


  textoAbaAtiva: {
    color: Cores.texto,
  },


  /* ==========================================================
     SALDO PRINCIPAL
  ========================================================== */

  saldoPrincipal: {
    marginTop: 2,

    padding: 18,

    borderRadius: 18,

    backgroundColor: Cores.texto,
  },


  saldoPrincipalLabel: {
    fontSize: 11,

    color: "#BFE0D6",
  },


  saldoPrincipalValor: {
    marginTop: 4,

    fontSize: 28,

    fontWeight: "700",

    color: Cores.branco,
  },


  saldoPrincipalDescricao: {
    marginTop: 7,

    fontSize: 11,

    color: "#BFE0D6",
  },


  /* ==========================================================
     CABEÇALHO DA LISTA
  ========================================================== */

  listaHeader: {
    marginTop: 22,

    marginBottom: 10,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },


  listaTitulo: {
    fontSize: 15,

    fontWeight: "700",

    color: Cores.texto,
  },


  listaQuantidade: {
    fontSize: 11,

    color: Cores.textoSuave,
  },


  /* ==========================================================
     LISTA
  ========================================================== */

  lista: {
    backgroundColor: Cores.branco,

    borderRadius: 18,

    paddingHorizontal: 16,

    borderWidth: 1,

    borderColor: Cores.borda,
  },


  cardPessoa: {
    minHeight: 78,

    flexDirection: "row",

    alignItems: "center",
  },


  avatar: {
    width: 44,

    height: 44,

    borderRadius: 22,

    justifyContent: "center",

    alignItems: "center",

    marginRight: 12,
  },


  avatarTexto: {
    fontSize: 15,

    fontWeight: "800",

    color: Cores.texto,
  },


  pessoaInfo: {
    flex: 1,
  },


  pessoaNome: {
    fontSize: 14,

    fontWeight: "700",

    color: Cores.texto,
  },


  pessoaStatus: {
    marginTop: 4,

    fontSize: 11,
  },


  statusPagar: {
    color: Cores.textoSuave,
  },


  statusQuitado: {
    color: Cores.principalEscuro,
  },


  /* ==========================================================
     PILLS
  ========================================================== */

  pill: {
    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 20,
  },


  pillPagar: {
    backgroundColor: "#FFE7E2",
  },


  pillQuitado: {
    backgroundColor: "#DDF7EE",
  },


  pillTexto: {
    fontSize: 11,

    fontWeight: "700",
  },


  pillTextoPagar: {
    color: "#D24A3B",
  },


  pillTextoQuitado: {
    color: Cores.principalEscuro,
  },


  /* ==========================================================
     DIVISOR
  ========================================================== */

  divisor: {
    height: 1,

    backgroundColor: Cores.borda,
  },


  /* ==========================================================
     INFORMAÇÃO
  ========================================================== */

  infoCard: {
    marginTop: 16,

    padding: 14,

    borderRadius: 14,

    flexDirection: "row",

    alignItems: "flex-start",

    backgroundColor: Cores.fundo,

    borderWidth: 1,

    borderColor: Cores.borda,
  },


  infoIcon: {
    width: 22,

    height: 22,

    borderRadius: 11,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: Cores.principal,

    marginRight: 10,
  },


  infoIconText: {
    fontSize: 12,

    fontWeight: "800",

    color: Cores.texto,
  },


  infoTexto: {
    flex: 1,

    fontSize: 11,

    lineHeight: 17,

    color: Cores.textoSuave,
  },


  espacoFinal: {
    height: 30,
  },

});
