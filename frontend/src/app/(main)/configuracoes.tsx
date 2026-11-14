/*
 * WEPAY — CONFIGURAÇÕES
 *
 * Configurações previstas:
 * - Notificações
 * - Tema
 * - Privacidade
 * - Exclusão de conta
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";

import { Cores } from "../../constants/Cores";
import { useUsuario } from "@/contexts/UsuarioContext";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { authApi } from "@/services/api";

export default function Configuracoes() {
  const { logout } = useUsuario();
  const {
    preferencias,
    carregando: carregandoPreferencias,
    atualizar: atualizarPreferencias,
  } = usePreferencias();

  const [modalExclusao, setModalExclusao] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [erroExclusao, setErroExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  function excluirConta() {
    Alert.alert(
      "Excluir conta",
      "Seus dados pessoais e gastos pessoais serão removidos. Grupos sem outros participantes também serão apagados. O histórico de grupos com outras pessoas será preservado com sua identidade anonimizada; a administração será transferida quando houver outro membro ativo. Descrições e observações desses registros permanecem.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            setSenhaAtual("");
            setErroExclusao("");
            setModalExclusao(true);
          },
        },
      ]
    );
  }

  async function confirmarExclusao() {
    if (!senhaAtual) {
      setErroExclusao("Digite sua senha atual para confirmar.");
      return;
    }

    setExcluindo(true);
    setErroExclusao("");
    try {
      await authApi.excluirConta(senhaAtual);
      setModalExclusao(false);
      await logout(false);
      router.replace("/(auth)/login");
      Alert.alert(
        "Conta excluída",
        "Seus dados pessoais foram removidos e o histórico compartilhado foi preservado de forma anonimizada."
      );
    } catch (erro) {
      setErroExclusao(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir a conta."
      );
    } finally {
      setExcluindo(false);
    }
  }

  function selecionarTema() {
    Alert.alert(
      "Tema",
      "Escolha o tema do aplicativo.",
      [
        {
          text: "Sistema",
          onPress: () => void atualizarPreferencias({ tema: "Sistema" }),
        },
        {
          text: "Claro",
          onPress: () => void atualizarPreferencias({ tema: "Claro" }),
        },
        {
          text: "Escuro",
          onPress: () => void atualizarPreferencias({ tema: "Escuro" }),
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            Configurações
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.sectionTitle}>
          Notificações
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                Notificações
              </Text>

              <Text style={styles.rowDescription}>
                Receber alertas de novas despesas em grupos.
              </Text>
            </View>

            <Switch
              value={preferencias.notificacoes}
              onValueChange={(notificacoes) =>
                void atualizarPreferencias({ notificacoes })
              }
              disabled={carregandoPreferencias}
              trackColor={{
                false: Cores.borda,
                true: Cores.principal,
              }}
              thumbColor={Cores.branco}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>
                Sons
              </Text>

              <Text style={styles.rowDescription}>
                Ativar sons das notificações push.
              </Text>
            </View>

            <Switch
              value={preferencias.som}
              onValueChange={(som) => void atualizarPreferencias({ som })}
              disabled={carregandoPreferencias}
              trackColor={{
                false: Cores.borda,
                true: Cores.principal,
              }}
              thumbColor={Cores.branco}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Organização
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push("/(main)/categorias")}
        >
          <View>
            <Text style={styles.rowTitle}>
              Categorias
            </Text>
            <Text style={styles.rowDescription}>
              Gerencie as categorias de despesas pessoais e em grupo.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Aparência
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={selecionarTema}
        >
          <View>
            <Text style={styles.rowTitle}>
              Tema
            </Text>

            <Text style={styles.rowDescription}>
              {preferencias.tema}
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Privacidade e conta
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => Alert.alert(
            "Privacidade",
            "Os dados da conta e as despesas são usados para fornecer os recursos do WePay. Ao usar o leitor de recibos, a imagem é enviada ao Google Gemini para extração dos dados; revise o resultado antes de salvar e evite enviar documentos sem relação com a despesa. Ao excluir a conta, os dados pessoais são removidos, mas o histórico financeiro compartilhado e as descrições/observações associadas permanecem anonimizados para os demais participantes."
          )}
        >
          <Text style={styles.rowTitle}>
            Privacidade
          </Text>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteCard}
          onPress={excluirConta}
        >
          <Text style={styles.deleteTitle}>
            Excluir minha conta
          </Text>

          <Text style={styles.deleteDescription}>
            Seus dados pessoais serão removidos e o histórico financeiro compartilhado será anonimizado.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={modalExclusao}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!excluindo) setModalExclusao(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirme sua senha</Text>
            <Text style={styles.modalDescription}>
              A exclusão é permanente. Informe sua senha atual para continuar.
            </Text>
            <TextInput
              style={styles.passwordInput}
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              placeholder="Senha atual"
              placeholderTextColor={Cores.textoSuave}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              editable={!excluindo}
              returnKeyType="done"
              onSubmitEditing={confirmarExclusao}
            />
            {erroExclusao ? (
              <Text style={styles.deleteError}>{erroExclusao}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={excluindo}
                onPress={() => setModalExclusao(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                disabled={excluindo}
                onPress={confirmarExclusao}
              >
                {excluindo ? (
                  <ActivityIndicator color={Cores.branco} />
                ) : (
                  <Text style={styles.confirmDeleteText}>Excluir conta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
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

  title: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  sectionTitle: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 25,
    marginBottom: 10,
  },

  card: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 16,
    paddingHorizontal: 15,
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  rowContent: {
    flex: 1,
    paddingRight: 12,
  },

  rowTitle: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "600",
  },

  rowDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  separator: {
    height: 1,
    backgroundColor: Cores.borda,
  },

  optionCard: {
    minHeight: 60,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  arrow: {
    color: Cores.textoSuave,
    fontSize: 22,
  },

  deleteCard: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.negativo,
    borderRadius: 14,
    padding: 16,
    marginTop: 15,
  },

  deleteTitle: {
    color: Cores.negativo,
    fontSize: 14,
    fontWeight: "700",
  },

  deleteDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    backgroundColor: Cores.branco,
    borderRadius: 18,
    padding: 20,
  },

  modalTitle: {
    color: Cores.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  modalDescription: {
    color: Cores.textoSuave,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  passwordInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    color: Cores.texto,
    paddingHorizontal: 14,
    marginTop: 16,
  },

  deleteError: {
    color: Cores.negativo,
    fontSize: 12,
    marginTop: 8,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
    gap: 10,
  },

  cancelButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  cancelButtonText: {
    color: Cores.textoSuave,
    fontWeight: "600",
  },

  confirmDeleteButton: {
    minHeight: 46,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Cores.negativo,
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  confirmDeleteText: {
    color: Cores.branco,
    fontWeight: "700",
  },
});