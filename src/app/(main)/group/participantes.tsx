/**
 * ============================================================
 * WEPAY - PARTICIPANTES DO GRUPO
 * ============================================================
 *
 * Esta tela apresenta os participantes de um grupo.
 *
 * Responsabilidades:
 *
 * - Mostrar o nome do grupo.
 * - Mostrar a quantidade de participantes.
 * - Listar os membros.
 * - Identificar o usuário atual.
 * - Permitir acessar novamente:
 *
 *      Despesas
 *      Participantes
 *      Saldos
 *
 * - Permitir iniciar o fluxo de adicionar participante.
 *
 *
 * PADRÃO DO PROJETO
 * ------------------------------------------------------------
 *
 * Esta tela segue o mesmo padrão utilizado pelo projeto
 * enviado no ZIP:
 *
 * React
 * useState quando necessário
 * React Native
 * TouchableOpacity
 * ScrollView
 * Alert
 * StatusBar
 * StyleSheet
 * Expo Router
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

import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "../../../constants/Cores";


/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */

export default function ParticipantesGrupo() {
  const { groupId = "1" } = useLocalSearchParams<{ groupId?: string }>();

  /**
   * ==========================================================
   * DADOS TEMPORÁRIOS
   * ==========================================================
   *
   * Estes participantes são dados mockados.
   *
   * Posteriormente eles serão recebidos do backend:
   *
   * React Native
   *      ↓
   * api.ts
   *      ↓
   * Flask
   *      ↓
   * MySQL
   */

  const participantes = [
    {
      id: "1",

      nome: "Você",

      inicial: "V",

      /**
       * Identifica o usuário atualmente autenticado.
       */
      voce: true,

      /**
       * No exemplo visual, usamos o papel de proprietário
       * somente para demonstrar a informação.
       */
      funcao: "Você",
    },

    {
      id: "2",

      nome: "João",

      inicial: "J",

      voce: false,

      funcao: "Participante",
    },

    {
      id: "3",

      nome: "Maria",

      inicial: "M",

      voce: false,

      funcao: "Participante",
    },

    {
      id: "4",

      nome: "Carlos",

      inicial: "C",

      voce: false,

      funcao: "Participante",
    },
  ];


  /**
   * ==========================================================
   * FUNÇÃO PARA NAVEGAR ENTRE AS ABAS
   * ==========================================================
   *
   * A tela de despesas do grupo já possuía essas abas.
   *
   * Agora, em vez de mostrar um Alert,
   * cada aba abrirá a tela correspondente.
   */

  function selecionarAba(aba: string) {

    if (aba === "despesas") {

      router.replace(
        "/(main)/group/despesas-grupo"
      );

      return;
    }


    if (aba === "saldos") {

      router.replace(
        "/(main)/group/saldos"
      );

      return;
    }

  }


  /**
   * ==========================================================
   * ADICIONAR PARTICIPANTE
   * ==========================================================
   *
   * O botão ainda não terá integração com o backend.
   *
   * Quando essa parte estiver pronta, poderá abrir:
   *
   * - tela de convite;
   * - QR Code;
   * - código do grupo;
   * - compartilhamento.
   */

  function adicionarParticipante() {
    router.push({
      pathname: "/(main)/group/convite-participante",
      params: { groupId },
    });
  }


  /**
   * ==========================================================
   * INTERFACE
   ========================================================== */

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

        {/* ----------------------------------------------------
            BOTÃO VOLTAR
        ----------------------------------------------------- */}

        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >

          <Text style={styles.iconeVoltar}>
            ‹
          </Text>

        </TouchableOpacity>


        {/* ----------------------------------------------------
            NOME DO GRUPO
        ----------------------------------------------------- */}

        <View style={styles.headerTextos}>

          <Text style={styles.tituloPequeno}>
            Grupo
          </Text>

          <Text style={styles.titulo}>
            Viagem Bahia
          </Text>

        </View>


        {/* ----------------------------------------------------
            MENU
        ----------------------------------------------------- */}

        <TouchableOpacity
          style={styles.botaoMenu}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert(
              "Opções",
              "Mais opções do grupo."
            )
          }
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

        {/* ----------------------------------------------------
            DESPESAS
        ----------------------------------------------------- */}

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


        {/* ----------------------------------------------------
            PARTICIPANTES - ATIVA
        ----------------------------------------------------- */}

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
            Participantes
          </Text>

        </TouchableOpacity>


        {/* ----------------------------------------------------
            SALDOS
        ----------------------------------------------------- */}

        <TouchableOpacity
          style={styles.aba}
          onPress={() =>
            selecionarAba("saldos")
          }
          activeOpacity={0.8}
        >

          <Text style={styles.textoAba}>
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
            RESUMO
        ===================================================== */}

        <View style={styles.resumo}>

          <View>

            <Text style={styles.resumoLabel}>
              Participantes do grupo
            </Text>

            <Text style={styles.resumoDescricao}>
              Viagem Bahia
            </Text>

          </View>


          {/* Quantidade */}
          <View style={styles.quantidadeContainer}>

            <Text style={styles.quantidade}>
              {participantes.length}
            </Text>

          </View>

        </View>


        {/* ====================================================
            DESCRIÇÃO
        ===================================================== */}

        <View style={styles.infoDescricao}>

          <Text style={styles.infoDescricaoTexto}>
            Pessoas que fazem parte deste grupo e participam
            das divisões de despesas.
          </Text>

        </View>


        {/* ====================================================
            LISTA DE PARTICIPANTES
        ===================================================== */}

        <View style={styles.listaParticipantes}>

          {participantes.map(
            (participante, index) => (

              <View key={participante.id}>

                {/* =================================================
                    PARTICIPANTE
                ================================================== */}

                <TouchableOpacity
                  style={styles.participante}
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/group/participante/[id]",
                      params: { id: participante.id, groupId },
                    })
                  }
                  activeOpacity={0.7}
                >

                  {/* -----------------------------------------------
                      AVATAR
                  ------------------------------------------------ */}

                  <View
                    style={[
                      styles.avatar,

                      participante.voce
                        ? styles.avatarVoce
                        : styles.avatarNormal,
                    ]}
                  >

                    <Text
                      style={[
                        styles.avatarTexto,

                        participante.voce
                          ? styles.avatarTextoVoce
                          : styles.avatarTextoNormal,
                      ]}
                    >
                      {participante.inicial}
                    </Text>

                  </View>


                  {/* -----------------------------------------------
                      INFORMAÇÕES
                  ------------------------------------------------ */}

                  <View style={styles.participanteInfo}>

                    <View style={styles.nomeLinha}>

                      <Text style={styles.nomeParticipante}>
                        {participante.nome}
                      </Text>


                      {/* 
                        Pequeno marcador para identificar
                        o usuário atual.
                      */}
                      {participante.voce && (

                        <View style={styles.tagVoce}>

                          <Text style={styles.tagVoceTexto}>
                            você
                          </Text>

                        </View>

                      )}

                    </View>


                    <Text style={styles.funcao}>
                      {participante.funcao}
                    </Text>

                  </View>


                  {/* -----------------------------------------------
                      MENU DO PARTICIPANTE
                  ------------------------------------------------ */}

                  <TouchableOpacity
                    style={styles.menuParticipante}
                    onPress={(event) => {
                      event.stopPropagation();
                      Alert.alert(
                        participante.nome,
                        "Opções do participante."
                      );
                    }}
                    activeOpacity={0.7}
                  >

                    <Text style={styles.menuParticipanteTexto}>
                      •••
                    </Text>

                  </TouchableOpacity>

                </TouchableOpacity>


                {/* =================================================
                    DIVISOR
                ================================================== */}

                {index < participantes.length - 1 && (

                  <View style={styles.divisor} />

                )}

              </View>

            )
          )}

        </View>


        {/* ====================================================
            BOTÃO ADICIONAR
        ===================================================== */}

        <TouchableOpacity
          style={styles.botaoAdicionar}
          onPress={adicionarParticipante}
          activeOpacity={0.8}
        >

          <View style={styles.iconeAdicionar}>

            <Text style={styles.iconeAdicionarTexto}>
              +
            </Text>

          </View>


          <View style={styles.adicionarTextoArea}>

            <Text style={styles.adicionarTitulo}>
              Adicionar participante
            </Text>

            <Text style={styles.adicionarDescricao}>
              Convide uma pessoa para este grupo
            </Text>

          </View>

        </TouchableOpacity>


        {/* Espaço inferior */}
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
     TELA
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
     RESUMO
  ========================================================== */

  resumo: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    marginBottom: 14,
  },


  resumoLabel: {
    fontSize: 14,

    color: Cores.textoSuave,

    marginBottom: 3,
  },


  resumoDescricao: {
    fontSize: 17,

    fontWeight: "700",

    color: Cores.texto,
  },


  quantidadeContainer: {
    width: 38,

    height: 38,

    borderRadius: 19,

    backgroundColor: "#DDF7EE",

    justifyContent: "center",

    alignItems: "center",
  },


  quantidade: {
    fontSize: 14,

    fontWeight: "700",

    color: Cores.texto,
  },


  /* ==========================================================
     DESCRIÇÃO
  ========================================================== */

  infoDescricao: {
    padding: 14,

    marginBottom: 12,

    borderRadius: 14,

    backgroundColor: Cores.fundo,

    borderWidth: 1,

    borderColor: Cores.borda,
  },


  infoDescricaoTexto: {
    fontSize: 12,

    lineHeight: 18,

    color: Cores.textoSuave,
  },


  /* ==========================================================
     LISTA
  ========================================================== */

  listaParticipantes: {
    backgroundColor: Cores.branco,

    borderRadius: 18,

    paddingHorizontal: 16,

    borderWidth: 1,

    borderColor: Cores.borda,
  },


  participante: {
    minHeight: 78,

    flexDirection: "row",

    alignItems: "center",
  },


  avatar: {
    width: 46,

    height: 46,

    borderRadius: 23,

    justifyContent: "center",

    alignItems: "center",

    marginRight: 12,
  },


  avatarVoce: {
    backgroundColor: Cores.principal,
  },


  avatarNormal: {
    backgroundColor: "#E9F9F3",
  },


  avatarTexto: {
    fontSize: 16,

    fontWeight: "800",
  },


  avatarTextoVoce: {
    color: Cores.texto,
  },


  avatarTextoNormal: {
    color: Cores.texto,
  },


  participanteInfo: {
    flex: 1,
  },


  nomeLinha: {
    flexDirection: "row",

    alignItems: "center",
  },


  nomeParticipante: {
    fontSize: 15,

    fontWeight: "700",

    color: Cores.texto,
  },


  tagVoce: {
    marginLeft: 7,

    paddingHorizontal: 7,

    paddingVertical: 3,

    borderRadius: 10,

    backgroundColor: "#DDF7EE",
  },


  tagVoceTexto: {
    fontSize: 9,

    fontWeight: "700",

    color: Cores.principalEscuro,
  },


  funcao: {
    marginTop: 4,

    fontSize: 11,

    color: Cores.textoSuave,
  },


  menuParticipante: {
    width: 36,

    height: 36,

    justifyContent: "center",

    alignItems: "center",
  },


  menuParticipanteTexto: {
    fontSize: 18,

    fontWeight: "700",

    color: Cores.textoSuave,

    letterSpacing: 1,
  },


  divisor: {
    height: 1,

    backgroundColor: Cores.borda,
  },


  /* ==========================================================
     ADICIONAR PARTICIPANTE
  ========================================================== */

  botaoAdicionar: {
    minHeight: 72,

    marginTop: 14,

    paddingHorizontal: 14,

    flexDirection: "row",

    alignItems: "center",

    borderRadius: 16,

    borderWidth: 1,

    borderColor: Cores.principalEscuro,

    backgroundColor: Cores.branco,
  },


  iconeAdicionar: {
    width: 42,

    height: 42,

    borderRadius: 14,

    backgroundColor: Cores.principal,

    justifyContent: "center",

    alignItems: "center",
  },


  iconeAdicionarTexto: {
    fontSize: 28,

    fontWeight: "300",

    color: Cores.texto,
  },


  adicionarTextoArea: {
    flex: 1,

    marginLeft: 11,
  },


  adicionarTitulo: {
    fontSize: 13,

    fontWeight: "700",

    color: Cores.texto,
  },


  adicionarDescricao: {
    marginTop: 3,

    fontSize: 10,

    color: Cores.textoSuave,
  },


  espacoFinal: {
    height: 30,
  },

});
