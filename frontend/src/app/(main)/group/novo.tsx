import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { gruposApi } from "@/services/api";

const NOME_MIN_LENGTH = 2;
const DESCRICAO_MAX_LENGTH = 200;

export default function NovoGrupo() {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const nomeTrimado = nome.trim();
  const descricaoTrimada = descricao.trim();
  const erroNome =
    nomeTrimado.length > 0 && nomeTrimado.length < NOME_MIN_LENGTH
      ? `O nome do grupo deve ter pelo menos ${NOME_MIN_LENGTH} caracteres.`
      : "";
  const erroDescricao =
    descricaoTrimada.length > DESCRICAO_MAX_LENGTH
      ? `A descrição deve ter no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`
      : "";

  async function criar() {
    const titulo = nomeTrimado;

    if (!titulo) {
      Alert.alert("Atenção", "Digite o nome do grupo.");
      return;
    }

    if (titulo.length < NOME_MIN_LENGTH) {
      Alert.alert(
        "Atenção",
        `O nome do grupo deve ter pelo menos ${NOME_MIN_LENGTH} caracteres.`
      );
      return;
    }

    if (descricaoTrimada.length > DESCRICAO_MAX_LENGTH) {
      Alert.alert(
        "Atenção",
        `A descrição deve ter no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`
      );
      return;
    }

    if (salvando) return;

    try {
      setSalvando(true);
      await gruposApi.criar({
        nome: titulo,
        descricao: descricaoTrimada || undefined,
      });
      Alert.alert(
        "Grupo criado",
        "Convide participantes para começar a dividir despesas.",
        [{ text: "OK", onPress: () => router.replace("/(main)/group") }]
      );
    } catch (erro) {
      Alert.alert(
        "Erro",
        erro instanceof Error ? erro.message : "Não foi possível criar o grupo."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.teclado}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formulario}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.botaoVoltar}
                onPress={() => router.back()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Text style={styles.voltar}>‹</Text>
              </TouchableOpacity>
              <View style={styles.headerTexto}>
                <Text style={styles.titulo}>Novo grupo</Text>
                <Text style={styles.subtitulo}>
                  Organize despesas para dividir com outras pessoas
                </Text>
              </View>
            </View>

            <View style={styles.introducao}>
              <View style={styles.iconeGrupo}>
                <Text style={styles.emojiGrupo}>👥</Text>
              </View>
              <View style={styles.introducaoTexto}>
                <Text style={styles.introducaoTitulo}>
                  Um espaço para dividir juntos
                </Text>
                <Text style={styles.introducaoSubtitulo}>
                  Registre despesas compartilhadas em um só lugar.
                </Text>
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Nome do grupo</Text>
              <TextInput
                style={[styles.input, erroNome ? styles.inputErro : null]}
                value={nome}
                onChangeText={setNome}
                placeholder="Ex.: Viagem para Bahia"
                placeholderTextColor="#8AA69E"
                autoCapitalize="sentences"
                returnKeyType="next"
                maxLength={80}
                accessibilityLabel="Nome do grupo"
              />
              <Text style={[styles.ajudaCampo, erroNome ? styles.erroTexto : null]}>
                {erroNome || "Escolha um nome fácil de reconhecer por todos."}
              </Text>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={[styles.input, styles.inputDescricao, erroDescricao ? styles.inputErro : null]}
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Ex.: Despesas da viagem de julho"
                placeholderTextColor="#8AA69E"
                autoCapitalize="sentences"
                multiline
                maxLength={DESCRICAO_MAX_LENGTH + 20}
                textAlignVertical="top"
                accessibilityLabel="Descrição do grupo, opcional"
              />
              <Text style={[styles.ajudaCampo, erroDescricao ? styles.erroTexto : null]}>
                {erroDescricao || `Máximo de ${DESCRICAO_MAX_LENGTH} caracteres.`}
              </Text>
            </View>

            <View style={styles.aviso}>
              <View style={styles.avisoIcone}>
                <Text style={styles.avisoIconeTexto}>✉</Text>
              </View>
              <View style={styles.avisoConteudo}>
                <Text style={styles.avisoTitulo}>Convide participantes depois</Text>
                <Text style={styles.avisoTexto}>
                  Depois de criar o grupo, você poderá enviar convites por e-mail
                  na tela de participantes.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
              onPress={criar}
              disabled={salvando}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {salvando ? (
                <View style={styles.carregando}>
                  <ActivityIndicator color="#0B3B33" />
                  <Text style={styles.botaoSalvarTexto}>Criando grupo...</Text>
                </View>
              ) : (
                <Text style={styles.botaoSalvarTexto}>Criar grupo</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoCancelar}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  teclado: { flex: 1 },
  conteudo: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },
  formulario: { width: "100%", maxWidth: 620, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 22,
  },
  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  voltar: { fontSize: 32, color: "#0B3B33", marginTop: -3 },
  headerTexto: { flex: 1 },
  titulo: { fontSize: 22, fontWeight: "700", color: "#0B3B33" },
  subtitulo: { fontSize: 12, color: "#6B8F86", marginTop: 4, lineHeight: 17 },
  introducao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F9F2",
    borderWidth: 1,
    borderColor: "#C9EFE1",
    borderRadius: 16,
    padding: 14,
    marginBottom: 25,
  },
  iconeGrupo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emojiGrupo: { fontSize: 23 },
  introducaoTexto: { flex: 1 },
  introducaoTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 3,
  },
  introducaoSubtitulo: { fontSize: 11, color: "#6B8F86", lineHeight: 16 },
  campo: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B3B33",
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 14,
    color: "#0B3B33",
  },
  ajudaCampo: { fontSize: 11, color: "#6B8F86", marginTop: 7, lineHeight: 16 },
  erroTexto: { color: "#B42318" },
  inputErro: { borderColor: "#D92D20" },
  inputDescricao: { height: 112, paddingTop: 14 },
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E8F9F2",
    borderWidth: 1,
    borderColor: "#C9EFE1",
    borderRadius: 15,
    padding: 15,
    marginTop: 1,
    marginBottom: 23,
  },
  avisoIcone: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  avisoIconeTexto: { fontSize: 18, color: "#00A17A" },
  avisoConteudo: { flex: 1 },
  avisoTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3B33",
    marginBottom: 4,
  },
  avisoTexto: { fontSize: 11, color: "#6B8F86", lineHeight: 17 },
  botaoSalvar: {
    height: 54,
    backgroundColor: "#00C896",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  botaoSalvarTexto: { fontSize: 15, fontWeight: "700", color: "#0B3B33" },
  carregando: { flexDirection: "row", alignItems: "center", gap: 9 },
  botaoDesabilitado: { opacity: 0.6 },
  botaoCancelar: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  botaoCancelarTexto: { fontSize: 13, fontWeight: "600", color: "#6B8F86" },
});
