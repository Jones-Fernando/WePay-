/*
 * WEPAY — NOVO GRUPO
 *
 * Campos:
 * - Nome
 * - Descrição
 * - Participantes iniciais
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
import { router } from "expo-router";

import { Cores } from "../../../constants/Cores";

type Pessoa = {
  id: number;
  nome: string;
  iniciais: string;
};

const pessoasDisponiveis: Pessoa[] = [
  { id: 1, nome: "Rafael Dias", iniciais: "RD" },
  { id: 2, nome: "Bruno Lima", iniciais: "BL" },
  { id: 3, nome: "Laura Nunes", iniciais: "LN" },
  { id: 4, nome: "Marina Souza", iniciais: "MS" },
];

export default function NovoGrupo() {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);

  function alternarParticipante(id: number) {
    setSelecionados((estadoAtual) => {
      if (estadoAtual.includes(id)) {
        return estadoAtual.filter((item) => item !== id);
      }

      return [...estadoAtual, id];
    });
  }

  function criarGrupo() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      Alert.alert("Atenção", "Digite o nome do grupo.");
      return;
    }

    /*
     * Futuramente:
     * enviar nome, descrição e participantes para a API.
     */
    console.log("Novo grupo:", {
      nome: nomeLimpo,
      descricao: descricao.trim(),
      participantes: selecionados,
    });

    Alert.alert(
      "Grupo criado",
      "O grupo foi criado com sucesso.",
      [
        {
          text: "OK",
          onPress: () => router.replace("../"),
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

          <Text style={styles.headerTitle}>Novo grupo</Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Nome do grupo</Text>

          <TextInput
            style={styles.input}
            placeholder="Ex.: Viagem Bahia"
            placeholderTextColor={Cores.textoSuave}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Descrição</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ex.: Despesas da viagem"
            placeholderTextColor={Cores.textoSuave}
            value={descricao}
            onChangeText={setDescricao}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Participantes iniciais</Text>

          <Text style={styles.helper}>
            Selecione as pessoas que já farão parte do grupo.
          </Text>

          {pessoasDisponiveis.map((pessoa) => {
            const selecionado = selecionados.includes(pessoa.id);

            return (
              <TouchableOpacity
                key={pessoa.id}
                style={[
                  styles.personCard,
                  selecionado && styles.personCardActive,
                ]}
                onPress={() => alternarParticipante(pessoa.id)}
                activeOpacity={0.8}
              >
                <View style={styles.personAvatar}>
                  <Text style={styles.personAvatarText}>
                    {pessoa.iniciais}
                  </Text>
                </View>

                <Text style={styles.personName}>
                  {pessoa.nome}
                </Text>

                <View
                  style={[
                    styles.checkbox,
                    selecionado && styles.checkboxActive,
                  ]}
                >
                  {selecionado && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={criarGrupo}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>
            Criar grupo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
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
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    fontSize: 32,
    color: Cores.texto,
    fontWeight: "300",
  },

  headerTitle: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
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

  helper: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },

  input: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
    fontSize: 14,
  },

  textArea: {
    height: 110,
    paddingTop: 14,
  },

  personCard: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  personCardActive: {
    borderColor: Cores.principal,
  },

  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Cores.campo,
    justifyContent: "center",
    alignItems: "center",
  },

  personAvatarText: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 12,
  },

  personName: {
    flex: 1,
    marginLeft: 11,
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "600",
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxActive: {
    backgroundColor: Cores.principal,
    borderColor: Cores.principal,
  },

  check: {
    color: Cores.texto,
    fontWeight: "700",
  },

  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  primaryButtonText: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 15,
  },

  cancelButton: {
    alignItems: "center",
    marginTop: 15,
    paddingVertical: 10,
  },

  cancelText: {
    color: Cores.textoSuave,
    fontWeight: "600",
    fontSize: 13,
  },
});
