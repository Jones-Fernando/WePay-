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

export default function DespesasGrupo() {
  const despesas = [
    {
      id: 1,
      titulo: "Pousada 3 noites",
      valor: "R$ 480,00",
      pagoPor: "Marina",
      data: "12 mai",
    },
    {
      id: 2,
      titulo: "Jantar na orla",
      valor: "R$ 186,00",
      pagoPor: "Rafael",
      data: "13 mai",
    },
    {
      id: 3,
      titulo: "Passeio de barco",
      valor: "R$ 260,00",
      pagoPor: "Marina",
      data: "14 mai",
    },
  ];

  function selecionarAba(aba: string) {
    if (aba === "participantes") {
      Alert.alert(
        "Participantes",
        "A tela de participantes será implementada em seguida."
      );
    }

    if (aba === "saldos") {
      Alert.alert(
        "Saldos",
        "A tela de saldos será implementada em seguida."
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => router.back()}
        >
          <Text style={styles.iconeVoltar}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextos}>
          <Text style={styles.tituloPequeno}>Grupo</Text>
          <Text style={styles.titulo}>Viagem Bahia</Text>
        </View>

        <TouchableOpacity
          style={styles.botaoMenu}
          onPress={() =>
            Alert.alert("Opções", "Mais opções do grupo.")
          }
        >
          <Text style={styles.menuText}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* ABAS */}
      <View style={styles.abas}>
        <TouchableOpacity style={[styles.aba, styles.abaAtiva]}>
          <Text style={[styles.textoAba, styles.textoAbaAtiva]}>
            Despesas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.aba}
          onPress={() => selecionarAba("participantes")}
        >
          <Text style={styles.textoAba}>Participantes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.aba}
          onPress={() => selecionarAba("saldos")}
        >
          <Text style={styles.textoAba}>Saldos</Text>
        </TouchableOpacity>
      </View>

      {/* CONTEÚDO */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.resumo}>
          <View>
            <Text style={styles.resumoLabel}>Despesas do grupo</Text>
            <Text style={styles.resumoDescricao}>
              Viagem Bahia
            </Text>
          </View>

          <Text style={styles.quantidade}>
            {despesas.length}
          </Text>
        </View>

        {/* CARDS DE DESPESAS */}
        {despesas.map((despesa) => (
          <TouchableOpacity
            key={despesa.id}
            activeOpacity={0.85}
            style={styles.recibo}
            onPress={() =>
              Alert.alert(
                despesa.titulo,
                `${despesa.valor}\nPago por ${despesa.pagoPor} · ${despesa.data}`
              )
            }
          >
            {/* DETALHE LATERAL */}
            <View style={styles.furoSuperior} />
            <View style={styles.furoInferior} />

            <View style={styles.reciboConteudo}>
              <View style={styles.reciboEsquerda}>
                <Text style={styles.reciboTitulo}>
                  {despesa.titulo}
                </Text>

                <Text style={styles.reciboInfo}>
                  Pago por {despesa.pagoPor} · {despesa.data}
                </Text>
              </View>

              <Text style={styles.reciboValor}>
                {despesa.valor}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ESPAÇO PARA O FAB */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* BOTÃO FLUTUANTE */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push("/nova-despesa")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5FBF7",
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
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  iconeVoltar: {
    fontSize: 32,
    color: "#0B3B33",
    lineHeight: 34,
    marginTop: -3,
  },

  headerTextos: {
    flex: 1,
  },

  tituloPequeno: {
    fontSize: 13,
    color: "#6B8F86",
    marginBottom: 2,
  },

  titulo: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0B3B33",
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
    color: "#6B8F86",
    letterSpacing: 2,
  },

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
    backgroundColor: "#FFFFFF",
  },

  textoAba: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B8F86",
  },

  textoAbaAtiva: {
    color: "#0B3B33",
  },

  scroll: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 20,
  },

  resumo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  resumoLabel: {
    fontSize: 14,
    color: "#6B8F86",
    marginBottom: 3,
  },

  resumoDescricao: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3B33",
  },

  quantidade: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DDF7EE",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3B33",
  },

  recibo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  reciboConteudo: {
    minHeight: 105,
    paddingHorizontal: 18,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  reciboEsquerda: {
    flex: 1,
    paddingRight: 12,
  },

  reciboTitulo: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 8,
  },

  reciboInfo: {
    fontSize: 13,
    color: "#6B8F86",
  },

  reciboValor: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3B33",
  },

  furoSuperior: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F5FBF7",
    left: -9,
    top: "50%",
    marginTop: -9,
    zIndex: 2,
  },

  furoInferior: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F5FBF7",
    right: -9,
    top: "50%",
    marginTop: -9,
    zIndex: 2,
  },

  fab: {
    position: "absolute",
    right: 22,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#00C896",
    justifyContent: "center",
    alignItems: "center",
    elevation: 7,
    shadowColor: "#0B3B33",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },

  fabText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "400",
    marginTop: -2,
  },
});