/*
 * WEPAY — DETALHES DO PARTICIPANTE
 *
 * Rota:
 * /group/participante/[id]
 *
 * Exemplos:
 * /group/participante/1
 * /group/participante/2
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "@/constants/Cores";

const participantes = [
  {
    id: 1,
    nome: "Você",
    email: "voce@email.com",
    iniciais: "V",
    permissao: "Administrador",
    status: "Ativo",
  },
  {
    id: 2,
    nome: "João",
    email: "joao@email.com",
    iniciais: "J",
    permissao: "Participante",
    status: "Ativo",
  },
  {
    id: 3,
    nome: "Maria",
    email: "maria@email.com",
    iniciais: "M",
    status: "Ativo",
  },
  {
    id: 4,
    nome: "Carlos",
    email: "carlos@email.com",
    iniciais: "C",
    permissao: "Participante",
    status: "Ativo",
  },
];

export default function DetalhesParticipante() {
  const { id, groupId } = useLocalSearchParams<{
    id: string;
    groupId?: string;
  }>();

  const participante =
    participantes.find((item) => String(item.id) === String(id)) ??
    participantes[0];

  const [permissao, setPermissao] = useState(
    participante.permissao
  );

  function alterarPermissao() {
    const novaPermissao =
      permissao === "Participante"
        ? "Administrador"
        : "Participante";

    setPermissao(novaPermissao);

    Alert.alert(
      "Permissão atualizada",
      `Agora o participante possui a permissão: ${novaPermissao}.`
    );
  }

  function reenviarConvite() {
    Alert.alert(
      "Convite reenviado",
      `Um novo convite foi enviado para ${participante.email}.`
    );
  }

  function removerParticipante() {
    Alert.alert(
      "Remover participante",
      `Deseja remover ${participante.nome} deste grupo?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            /*
             * Futuramente:
             * DELETE /groups/:groupId/members/:id
             */
            console.log("Remover participante:", {
              groupId,
              participanteId: id,
            });

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
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Participante
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {participante.iniciais}
            </Text>
          </View>

          <Text style={styles.name}>{participante.nome}</Text>

          <Text style={styles.email}>
            {participante.email}
          </Text>

          <View style={styles.status}>
            <Text style={styles.statusText}>
              {participante.status}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissões</Text>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={alterarPermissao}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>
                {permissao}
              </Text>

              <Text style={styles.optionText}>
                Toque para alternar a permissão.
              </Text>
            </View>

            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={reenviarConvite}
          >
            <Text style={styles.secondaryButtonText}>
              Reenviar convite
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={removerParticipante}
          >
            <Text style={styles.dangerButtonText}>
              Remover participante
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
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 35,
  },

  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    color: Cores.texto,
    fontSize: 32,
  },

  headerTitle: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  profileCard: {
    alignItems: "center",
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 18,
    padding: 24,
    marginTop: 15,
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: Cores.texto,
    fontSize: 20,
    fontWeight: "700",
  },

  name: {
    color: Cores.texto,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 15,
  },

  email: {
    color: Cores.textoSuave,
    fontSize: 13,
    marginTop: 5,
  },

  status: {
    backgroundColor: Cores.campo,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },

  statusText: {
    color: Cores.principalEscuro,
    fontSize: 11,
    fontWeight: "700",
  },

  section: {
    marginTop: 25,
  },

  sectionTitle: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  optionCard: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  optionContent: {
    flex: 1,
  },

  optionTitle: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 14,
  },

  optionText: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 4,
  },

  arrow: {
    color: Cores.textoSuave,
    fontSize: 23,
  },

  secondaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  secondaryButtonText: {
    color: Cores.texto,
    fontWeight: "700",
  },

  dangerButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.negativo,
    justifyContent: "center",
    alignItems: "center",
  },

  dangerButtonText: {
    color: Cores.negativo,
    fontWeight: "700",
  },
});
