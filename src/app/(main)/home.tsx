/*
 * WEPAY — HOME
 * Migrado do projeto de referência para (main)/home.tsx.
 * Mantém o padrão visual do ZIP: saldo, seletor Pessoal/Em grupo, cards,
 * FAB e navegação inferior.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import {router} from "expo-router";
import { useUsuario } from "@/contexts/UsuarioContext";

type Aba = "grupos" | "pessoal";

export default function Home() {
  const [abaSelecionada, setAbaSelecionada] = useState<Aba>("pessoal");
  const { usuario } = useUsuario();

  const irParaDespesasGrupo = () => {
    setAbaSelecionada("grupos");
  };

  const irParaBotaoMais = () => {
    if (abaSelecionada === "pessoal") {
      router.push("/(main)/personal/despesas-pessoais");
      return;
    }

    router.push("/(main)/group/despesas-grupo");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>

        {/* =========================
            CONTEÚDO PRINCIPAL
        ========================= */}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View>
              <Text style={styles.hello}>
                Olá,
              </Text>

              <Text style={styles.userName}>
                {usuario.nome}
              </Text>
            </View>

            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push("/(main)/gerenciamento-perfil")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Abrir gerenciamento de perfil"
            >
              <Text style={styles.avatarText}>
                {usuario.iniciais}
              </Text>
            </TouchableOpacity>
          </View>

          {/* =========================
              CARD DE SALDO
          ========================= */}

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>
              Saldo geral
            </Text>

            <Text style={styles.balanceValue}>
              R$ 240,50
            </Text>

            <View style={styles.balanceIndicators}>

              <View style={styles.positivePill}>
                <Text style={styles.positivePillText}>
                  ▲ a receber
                </Text>
              </View>

              <View style={styles.negativePill}>
                <Text style={styles.negativePillText}>
                  ▼ R$ 90,00
                </Text>
              </View>

            </View>

          </View>

          {/* =========================
              SELETOR
          ========================= */}

          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segment, abaSelecionada === "pessoal" && styles.segmentActive]}
              onPress={() => setAbaSelecionada("pessoal")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, abaSelecionada === "pessoal" && styles.segmentTextActive]}>
                🙋 Pessoal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segment, abaSelecionada === "grupos" && styles.segmentActive]}
              onPress={() => setAbaSelecionada("grupos")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, abaSelecionada === "grupos" && styles.segmentTextActive]}>
                👥 Em grupo
              </Text>
            </TouchableOpacity>
          </View>

          {/* =========================
              CONTEÚDO EM GRUPO
          ========================= */}

          {abaSelecionada === "grupos" && (
            <View style={styles.content}>

              <Text style={styles.sectionTitle}>
                Seus grupos
              </Text>

              {/* Grupo 1 */}
              <TouchableOpacity
                style={styles.groupCard}
                activeOpacity={0.8}
              >

                <View
                  style={[
                    styles.groupAvatar,
                    styles.groupAvatarCoral,
                  ]}
                >
                  <Text style={styles.groupAvatarText}>
                    VB
                  </Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>
                    Viagem Bahia
                  </Text>

                  <Text style={styles.groupMembers}>
                    4 participantes
                  </Text>
                </View>

                <Text style={styles.receiveValue}>
                  +R$ 120
                </Text>

              </TouchableOpacity>

              {/* Grupo 2 */}
              <TouchableOpacity
                style={styles.groupCard}
                activeOpacity={0.8}
              >

                <View
                  style={[
                    styles.groupAvatar,
                    styles.groupAvatarBlue,
                  ]}
                >
                  <Text style={styles.groupAvatarText}>
                    RP
                  </Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>
                    Apê Rep. 302
                  </Text>

                  <Text style={styles.groupMembers}>
                    3 participantes
                  </Text>
                </View>

                <Text style={styles.debtValue}>
                  −R$ 45
                </Text>

              </TouchableOpacity>

            </View>
          )}
      
         <TouchableOpacity
  onPress={() =>
    router.push({
      pathname: "/(main)/group/detalhes-despesa",
      params: {
        descricao: "Mercado",
        valor: "210",
        categoria: "Alimentação",
      },
    })
  }
>
  <Text>Mercado</Text>
</TouchableOpacity>

          {/* =========================
              DESPESAS PESSOAIS
          ========================= */}

          {abaSelecionada === "pessoal" && (
            <View style={styles.content}>

              <Text style={styles.sectionTitle}>
                Seus gastos pessoais
              </Text>

              {/* Mercado */}
              <TouchableOpacity
                style={styles.groupCard}
                activeOpacity={0.8}
              >

                <View
                  style={[
                    styles.groupAvatar,
                    styles.personalMarket,
                  ]}
                >
                  <Text style={styles.emoji}>
                    🛒
                  </Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>
                    Mercado
                  </Text>

                  <Text style={styles.groupMembers}>
                    Alimentação · 4 mai
                  </Text>
                </View>

                <Text style={styles.personalValue}>
                  R$ 210
                </Text>

              </TouchableOpacity>

              {/* Streaming */}
              <TouchableOpacity
                style={styles.groupCard}
                activeOpacity={0.8}
              >

                <View
                  style={[
                    styles.groupAvatar,
                    styles.personalStreaming,
                  ]}
                >
                  <Text style={styles.emoji}>
                    🎬
                  </Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>
                    Streaming
                  </Text>

                  <Text style={styles.groupMembers}>
                    Assinatura · 8 mai
                  </Text>
                </View>

                <Text style={styles.personalValue}>
                  R$ 40
                </Text>

              </TouchableOpacity>

            </View>
          )}

        </ScrollView>

        {/* =========================
            BOTÃO FLUTUANTE
        ========================= */}

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={irParaBotaoMais}
        >
          <Text style={styles.fabText}>
            +
          </Text>
        </TouchableOpacity>

        {/* =========================
            NAVEGAÇÃO INFERIOR
        ========================= */}

        <View style={styles.bottomNavigation}>

          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <Text style={styles.navIconActive}>
              ⌂
            </Text>

            <Text style={styles.navTextActive}>
              Início
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <Text style={styles.navIcon}>
              👥
            </Text>

            <Text style={styles.navText}>
              Grupos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => setAbaSelecionada("grupos")}
          >
            <Text style={styles.navIcon}>
              💳
            </Text>

            <Text style={styles.navText}>
              Despesas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <Text style={styles.navIcon}>
              👤
            </Text>

            <Text style={styles.navText}>
              Perfil
            </Text>
          </TouchableOpacity>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* =========================
     CONTAINER
  ========================= */

  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 100,
  },

  /* =========================
     HEADER
  ========================= */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hello: {
    color: "#6B8F86",
    fontSize: 11,
  },

  userName: {
    color: "#0B3B33",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0B3B33",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  /* =========================
     SALDO
  ========================= */

  balanceCard: {
    marginTop: 40,
    backgroundColor: "#0B3B33",
    borderRadius: 25,
    padding: 50,
  },

  balanceLabel: {
    marginTop: -30,
    color: "#BFE0D6",
    fontSize: 15,
  },

  balanceValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },

  balanceIndicators: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  positivePill: {
    backgroundColor: "#DEF7EC",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  positivePillText: {
    color: "#00A17A",
    fontSize: 10,
    fontWeight: "700",
  },

  negativePill: {
    backgroundColor: "#FFE7E2",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  negativePillText: {
    color: "#D24A3B",
    fontSize: 10,
    fontWeight: "700",
  },

  /* =========================
     SEGMENTO
  ========================= */

  segmentContainer: {
    marginTop: 16,
    flexDirection: "row",
    backgroundColor: "#F0F8F4",
    borderRadius: 12,
    padding: 3,
  },

  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentActive: {
    backgroundColor: "#0B3B33",
  },

  segmentText: {
    color: "#6B8F86",
    fontSize: 11,
    fontWeight: "600",
  },

  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  /* =========================
     CONTEÚDO
  ========================= */

  content: {
    marginTop: 18,
  },

  sectionTitle: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },

  /* =========================
     CARDS
  ========================= */

  groupCard: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },

  groupAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  groupAvatarCoral: {
    backgroundColor: "#FF6B5C",
  },

  groupAvatarBlue: {
    backgroundColor: "#4C8DFF",
  },

  personalMarket: {
    backgroundColor: "#0B3B33",
  },

  personalStreaming: {
    backgroundColor: "#FFB454",
  },

  groupAvatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  emoji: {
    fontSize: 17,
  },

  groupInfo: {
    flex: 1,
    marginLeft: 10,
  },

  groupName: {
    color: "#0B3B33",
    fontSize: 12,
    fontWeight: "700",
  },

  groupMembers: {
    color: "#6B8F86",
    fontSize: 10,
    marginTop: 3,
  },

  receiveValue: {
    color: "#00A17A",
    fontSize: 12,
    fontWeight: "700",
  },

  debtValue: {
    color: "#D24A3B",
    fontSize: 12,
    fontWeight: "700",
  },

  personalValue: {
    color: "#0B3B33",
    fontSize: 12,
    fontWeight: "700",
  },

  /* =========================
     BOTÃO FLUTUANTE
  ========================= */

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
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 6,
  },

  fabText: {
    color: "#0B3B33",
    fontSize: 28,
    fontWeight: "600",
    marginTop: -2,
  },

  /* =========================
     NAVEGAÇÃO
  ========================= */

  bottomNavigation: {
    height: 68,
    borderTopWidth: 1,
    borderTopColor: "#E1EEE8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },

  navIconActive: {
    fontSize: 20,
    color: "#00A17A",
  },

  navIcon: {
    fontSize: 18,
    opacity: 0.6,
  },

  navTextActive: {
    color: "#00A17A",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },

  navText: {
    color: "#6B8F86",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
});
