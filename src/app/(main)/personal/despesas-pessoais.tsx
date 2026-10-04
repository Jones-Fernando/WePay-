/*
 * WEPAY — DESPESAS PESSOAIS
 * Migrado do projeto de referência para (main)/personal/.
 */
import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
} from "react-native";
import { router } from "expo-router";

export default function DespesasPessoais() {
  const despesas = [
    {
      id: 1,
      icone: "🛒",
      titulo: "Mercado",
      categoria: "Alimentação",
      data: "4 mai",
      valor: "R$ 210,00",
    },
    {
      id: 2,
      icone: "🚕",
      titulo: "Corrida app",
      categoria: "Transporte",
      data: "6 mai",
      valor: "R$ 28,90",
    },
    {
      id: 3,
      icone: "🎬",
      titulo: "Assinatura streaming",
      categoria: "Assinatura",
      data: "8 mai",
      valor: "R$ 39,90",
    },
  ];

  function abrirDespesa(despesa: (typeof despesas)[number]) {
    Alert.alert(
      despesa.titulo,
      `${despesa.valor}\n${despesa.categoria} · ${despesa.data}`
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => router.replace("/(main)/home")}
        >
          <Text style={styles.iconeVoltar}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextos}>
          <Text style={styles.titulo}>Despesas pessoais</Text>
          <Text style={styles.subtitulo}>Fora dos grupos — só seu controle</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardResumo}>
          <Text style={styles.resumoLabel}>Gasto em maio</Text>
          <Text style={styles.resumoValor}>R$ 612,40</Text>

          <View style={styles.barra}>
            <View style={[styles.barraParte, styles.barraVerde, { flex: 4 }]} />
            <View style={[styles.barraParte, styles.barraCoral, { flex: 2 }]} />
            <View style={[styles.barraParte, styles.barraAzul, { flex: 2 }]} />
            <View style={[styles.barraParte, styles.barraLaranja, { flex: 1 }]} />
          </View>
        </View>

        <View style={styles.listaHeader}>
          <Text style={styles.listaTitulo}>Seus gastos</Text>
          <Text style={styles.listaQuantidade}>{despesas.length}</Text>
        </View>

        {despesas.map((despesa) => (
          <TouchableOpacity
            key={despesa.id}
            activeOpacity={0.85}
            style={styles.recibo}
            onPress={() => abrirDespesa(despesa)}
          >
            <View style={styles.reciboConteudo}>
              <View style={styles.iconeDespesa}>
                <Text style={styles.iconeTexto}>{despesa.icone}</Text>
              </View>

              <View style={styles.informacoes}>
                <Text style={styles.despesaTitulo}>{despesa.titulo}</Text>
                <Text style={styles.despesaInfo}>
                  {despesa.categoria} · {despesa.data}
                </Text>
              </View>

              <Text style={styles.despesaValor}>{despesa.valor}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.espacoFinal} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/(main)/personal/nova-despesa-pessoal",
            params: { tipo: "pessoal" },
          })
        }
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
  titulo: {
    fontSize: 23,
    fontWeight: "700",
    color: "#0B3B33",
  },
  subtitulo: {
    fontSize: 12,
    color: "#6B8F86",
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cardResumo: {
    backgroundColor: "#F0F8F4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  resumoLabel: {
    fontSize: 12,
    color: "#6B8F86",
  },
  resumoValor: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "700",
    color: "#0B3B33",
  },
  barra: {
    flexDirection: "row",
    height: 10,
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 14,
  },
  barraParte: {
    height: 10,
  },
  barraVerde: {
    backgroundColor: "#00C896",
  },
  barraCoral: {
    backgroundColor: "#FF7A66",
  },
  barraAzul: {
    backgroundColor: "#4C8DFF",
  },
  barraLaranja: {
    backgroundColor: "#FFB454",
  },
  listaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listaTitulo: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
  },
  listaQuantidade: {
    color: "#6B8F86",
    fontSize: 12,
    fontWeight: "700",
  },
  recibo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    marginBottom: 12,
  },
  reciboConteudo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconeDespesa: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EAF7F3",
    justifyContent: "center",
    alignItems: "center",
  },
  iconeTexto: {
    fontSize: 18,
  },
  informacoes: {
    flex: 1,
    marginLeft: 10,
  },
  despesaTitulo: {
    color: "#0B3B33",
    fontSize: 13,
    fontWeight: "700",
  },
  despesaInfo: {
    color: "#6B8F86",
    fontSize: 10,
    marginTop: 3,
  },
  despesaValor: {
    color: "#0B3B33",
    fontSize: 12,
    fontWeight: "700",
  },
  espacoFinal: {
    height: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 82,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#00C896",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00C896",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  fabText: {
    color: "#0B3B33",
    fontSize: 28,
    fontWeight: "600",
    marginTop: -2,
  },
});