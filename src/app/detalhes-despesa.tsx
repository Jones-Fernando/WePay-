import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";

export default function DetalhesDespesa() {
  // Dados de exemplo.
  // Depois vamos substituir pelos dados vindos do backend.
  const despesa = {
    descricao: "Jantar",
    valor: 200,
    categoria: "Alimentação",
    data: "12 de setembro de 2026",
    pagoPor: "Você",
    tipoDivisao: "Divisão igual",
  };

  const participantes = [
    {
      nome: "Você",
      inicial: "V",
      valor: 50,
      status: "Você pagou",
    },
    {
      nome: "João",
      inicial: "J",
      valor: 50,
      status: "Deve a você",
    },
    {
      nome: "Maria",
      inicial: "M",
      valor: 50,
      status: "Deve a você",
    },
    {
      nome: "Carlos",
      inicial: "C",
      valor: 50,
      status: "Deve a você",
    },
  ];

  const totalAReceber = participantes
    .filter((pessoa) => pessoa.nome !== "Você")
    .reduce((total, pessoa) => total + pessoa.valor, 0);

  function editarDespesa() {
    Alert.alert(
      "Editar despesa",
      "A edição da despesa será implementada na próxima etapa."
    );
  }

  function excluirDespesa() {
    Alert.alert(
      "Excluir despesa",
      "Tem certeza que deseja excluir esta despesa?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            console.log("Despesa excluída");
            router.back();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => router.back()}
          >
            <Text style={styles.voltarIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Detalhes da despesa</Text>

          <TouchableOpacity
            style={styles.botaoMenu}
            onPress={() =>
              Alert.alert("Opções", "Escolha uma ação", [
                {
                  text: "Editar",
                  onPress: editarDespesa,
                },
                {
                  text: "Excluir",
                  style: "destructive",
                  onPress: excluirDespesa,
                },
                {
                  text: "Cancelar",
                  style: "cancel",
                },
              ])
            }
          >
            <Text style={styles.menuIcon}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* RESUMO */}
        <View style={styles.resumoCard}>
          <View style={styles.iconeDespesa}>
            <Text style={styles.iconeTexto}>🍽️</Text>
          </View>

          <Text style={styles.descricao}>{despesa.descricao}</Text>

          <Text style={styles.valorPrincipal}>
            R$ {despesa.valor.toFixed(2).replace(".", ",")}
          </Text>

          <View style={styles.categoriaBadge}>
            <Text style={styles.categoriaTexto}>
              {despesa.categoria}
            </Text>
          </View>

          <Text style={styles.data}>{despesa.data}</Text>
        </View>

        {/* INFORMAÇÕES */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Informações</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoLinha}>
              <View style={styles.infoIconContainer}>
                <Text style={styles.infoIcon}>💳</Text>
              </View>

              <View style={styles.infoConteudo}>
                <Text style={styles.infoLabel}>Pago por</Text>
                <Text style={styles.infoValor}>
                  {despesa.pagoPor}
                </Text>
              </View>
            </View>

            <View style={styles.divisor} />

            <View style={styles.infoLinha}>
              <View style={styles.infoIconContainer}>
                <Text style={styles.infoIcon}>⚖️</Text>
              </View>

              <View style={styles.infoConteudo}>
                <Text style={styles.infoLabel}>Divisão</Text>
                <Text style={styles.infoValor}>
                  {despesa.tipoDivisao}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PARTICIPANTES */}
        <View style={styles.secao}>
          <View style={styles.tituloLinha}>
            <Text style={styles.tituloSecao}>Participantes</Text>

            <Text style={styles.quantidade}>
              {participantes.length} pessoas
            </Text>
          </View>

          <View style={styles.participantesCard}>
            {participantes.map((pessoa, index) => (
              <View key={pessoa.nome}>
                <View style={styles.participante}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>
                      {pessoa.inicial}
                    </Text>
                  </View>

                  <View style={styles.participanteInfo}>
                    <Text style={styles.participanteNome}>
                      {pessoa.nome}
                    </Text>

                    <Text
                      style={[
                        styles.participanteStatus,
                        pessoa.nome === "Você"
                          ? styles.statusVoce
                          : styles.statusDivida,
                      ]}
                    >
                      {pessoa.status}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.valorParticipante,
                      pessoa.nome === "Você"
                        ? styles.valorVoce
                        : styles.valorDevido,
                    ]}
                  >
                    R$ {pessoa.valor.toFixed(2).replace(".", ",")}
                  </Text>
                </View>

                {index < participantes.length - 1 && (
                  <View style={styles.divisor} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* RESUMO DO SALDO */}
        <View style={styles.saldoCard}>
          <View>
            <Text style={styles.saldoTitulo}>
              Você tem a receber
            </Text>

            <Text style={styles.saldoDescricao}>
              {participantes.length - 1} pessoas devem a você
            </Text>
          </View>

          <Text style={styles.saldoValor}>
            + R$ {totalAReceber.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        {/* BOTÕES */}
        <View style={styles.acoes}>
          <TouchableOpacity
            style={styles.botaoEditar}
            onPress={editarDespesa}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoEditarTexto}>Editar despesa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoExcluir}
            onPress={excluirDespesa}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoExcluirTexto}>
              Excluir despesa
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },

  scrollContent: {
    paddingBottom: 40,
  },

  /* =========================
     CABEÇALHO
  ========================= */

  header: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  voltarIcon: {
    fontSize: 34,
    lineHeight: 36,
    color: "#0B3B33",
    marginTop: -3,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3B33",
  },

  botaoMenu: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  menuIcon: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0B3B33",
    marginTop: -6,
  },

  /* =========================
     RESUMO
  ========================= */

  resumoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  iconeDespesa: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E9F9F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  iconeTexto: {
    fontSize: 28,
  },

  descricao: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 8,
  },

  valorPrincipal: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0B3B33",
    marginBottom: 12,
  },

  categoriaBadge: {
    backgroundColor: "#E9F9F3",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 10,
  },

  categoriaTexto: {
    color: "#00A17A",
    fontSize: 13,
    fontWeight: "700",
  },

  data: {
    color: "#6B8F86",
    fontSize: 13,
  },

  /* =========================
     SEÇÕES
  ========================= */

  secao: {
    marginTop: 26,
    paddingHorizontal: 20,
  },

  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  tituloSecao: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 12,
  },

  quantidade: {
    fontSize: 13,
    color: "#6B8F86",
    marginBottom: 12,
  },

  /* =========================
     INFORMAÇÕES
  ========================= */

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  infoLinha: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  infoIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F5FBF7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  infoIcon: {
    fontSize: 18,
  },

  infoConteudo: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 12,
    color: "#6B8F86",
    marginBottom: 3,
  },

  infoValor: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0B3B33",
  },

  divisor: {
    height: 1,
    backgroundColor: "#E1EEE8",
  },

  /* =========================
     PARTICIPANTES
  ========================= */

  participantesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },

  participante: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DDF6ED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarTexto: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B3B33",
  },

  participanteInfo: {
    flex: 1,
  },

  participanteNome: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 4,
  },

  participanteStatus: {
    fontSize: 12,
  },

  statusVoce: {
    color: "#6B8F86",
  },

  statusDivida: {
    color: "#00A17A",
  },

  valorParticipante: {
    fontSize: 15,
    fontWeight: "800",
  },

  valorVoce: {
    color: "#0B3B33",
  },

  valorDevido: {
    color: "#00A17A",
  },

  /* =========================
     SALDO
  ========================= */

  saldoCard: {
    marginHorizontal: 20,
    marginTop: 26,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#E9F9F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  saldoTitulo: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },

  saldoDescricao: {
    color: "#6B8F86",
    fontSize: 12,
  },

  saldoValor: {
    color: "#00A17A",
    fontSize: 17,
    fontWeight: "800",
  },

  /* =========================
     AÇÕES
  ========================= */

  acoes: {
    paddingHorizontal: 20,
    marginTop: 26,
    gap: 10,
  },

  botaoEditar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#00C896",
    justifyContent: "center",
    alignItems: "center",
  },

  botaoEditarTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  botaoExcluir: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FF6B5C",
    justifyContent: "center",
    alignItems: "center",
  },

  botaoExcluirTexto: {
    color: "#FF6B5C",
    fontSize: 15,
    fontWeight: "700",
  },
});