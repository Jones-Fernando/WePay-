/*
 * WEPAY — CONVIDAR PARTICIPANTE
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "../../../constants/Cores";

export default function ConviteParticipante() {
  const { groupId } = useLocalSearchParams<{
    groupId?: string;
  }>();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);

  function enviarConvite() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();

    if (!nomeLimpo) {
      Alert.alert("Atenção", "Digite o nome do participante.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(emailLimpo)) {
      Alert.alert("Atenção", "Digite um e-mail válido.");
      return;
    }

    setCarregando(true);

    /*
     * Simulação do envio enquanto a API não existe.
     */
    setTimeout(() => {
      setCarregando(false);

      Alert.alert(
        "Convite enviado",
        `O convite foi enviado para ${emailLimpo}.`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    }, 700);

    console.log("Convite:", {
      groupId,
      nome: nomeLimpo,
      email: emailLimpo,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Convidar participante
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Adicionar ao grupo
          </Text>

          <Text style={styles.infoText}>
            Informe os dados da pessoa que deseja convidar.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Nome</Text>

          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            placeholderTextColor={Cores.textoSuave}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>E-mail</Text>

          <TextInput
            style={styles.input}
            placeholder="exemplo@email.com"
            placeholderTextColor={Cores.textoSuave}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            carregando && styles.disabledButton,
          ]}
          onPress={enviarConvite}
          disabled={carregando}
        >
          <Text style={styles.primaryButtonText}>
            {carregando ? "Enviando..." : "Enviar convite"}
          </Text>
        </TouchableOpacity>
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
    fontSize: 32,
    color: Cores.texto,
  },

  headerTitle: {
    color: Cores.texto,
    fontSize: 17,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  infoCard: {
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 15,
    padding: 16,
    marginTop: 20,
  },

  infoTitle: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 15,
  },

  infoText: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  section: {
    marginTop: 22,
  },

  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
  },

  primaryButton: {
    height: 52,
    backgroundColor: Cores.principal,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  disabledButton: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: Cores.texto,
    fontSize: 15,
    fontWeight: "700",
  },
});