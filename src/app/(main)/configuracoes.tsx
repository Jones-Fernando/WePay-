import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
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
  Modal,
  TextInput,
} from "react-native";
import { router, type Href } from "expo-router";

import { useUsuario } from "@/contexts/UsuarioContext";
import { Alert } from "@/services/feedback";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { authApi } from "@/services/api";
import { useFieldFocus } from "@/hooks/useFieldFocus";
import { ExternalLink } from "@/components/external-link";

export default function Configuracoes() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { logout } = useUsuario();
  const {
    preferencias,
    carregando: carregandoPreferencias,
    atualizar: atualizarPreferencias,
  } = usePreferencias();

  const [modalExclusao, setModalExclusao] = useState(false);
  const [modalTema, setModalTema] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [erroExclusao, setErroExclusao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();

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
    setModalTema(true);
  }

  function selecionarOpcaoTema(tema: "Sistema" | "Claro" | "Escuro") {
    setModalTema(false);
    void atualizarPreferencias({ tema });
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
                Novas despesas
              </Text>

              <Text style={styles.rowDescription}>
                Avisar quando uma despesa for criada em um grupo.
              </Text>
            </View>

            <Switch
              value={preferencias.despesas}
              onValueChange={(despesas) =>
                void atualizarPreferencias({ despesas })
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
                Lembretes de cobrança
              </Text>

              <Text style={styles.rowDescription}>
                Receber lembretes de valores pendentes nos grupos.
              </Text>
            </View>

            <Switch
              value={preferencias.cobrancas}
              onValueChange={(cobrancas) =>
                void atualizarPreferencias({ cobrancas })
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
              <Text style={styles.rowTitle}>Push no dispositivo</Text>
              <Text style={styles.rowDescription}>
                Mostrar avisos mesmo quando o app estiver fechado.
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
              <Text style={styles.rowTitle}>Sons</Text>
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

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() =>
            router.push("/(main)/group/gerenciar-icones-capa" as Href)
          }
        >
          <View>
            <Text style={styles.rowTitle}>Ícones de capa dos grupos</Text>
            <Text style={styles.rowDescription}>
              Escolha quais ícones ficam disponíveis ao criar ou editar grupos.
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
            Disponível somente quando não houver saldo em dívida. Seus dados pessoais serão removidos e o histórico financeiro compartilhado será anonimizado.
          </Text>
        </TouchableOpacity>

        <ExternalLink
          href="https://icons8.com.br/icon/CYgFsQyxgTod/pizza-emoji"
          style={styles.credit}
        >
          Ícones de categoria: Icons8
        </ExternalLink>
      </ScrollView>

      <Modal
        visible={modalTema}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTema(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tema do aplicativo</Text>
            <Text style={styles.modalDescription}>
              Escolha como o WePay deve aparecer neste dispositivo.
            </Text>
            {([
              ["Sistema", "Usa a aparência do dispositivo."],
              ["Claro", "Mantém as cores claras do WePay."],
              ["Escuro", "Fundo preto, cartões grafite e textos claros."],
            ] as const).map(([tema, descricao]) => {
              const selecionado = preferencias.tema === tema;
              return (
                <TouchableOpacity
                  key={tema}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selecionado }}
                  style={[
                    styles.themeOption,
                    selecionado && styles.themeOptionSelected,
                  ]}
                  onPress={() => selecionarOpcaoTema(tema)}
                >
                  <View style={styles.themeOptionCopy}>
                    <Text style={styles.themeOptionTitle}>{tema}</Text>
                    <Text style={styles.themeOptionDescription}>
                      {descricao}
                    </Text>
                  </View>
                  {selecionado ? (
                    <Text style={styles.themeOptionCheck}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalTema(false)}
              >
                <Text style={styles.cancelButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              style={[
                styles.passwordInput,
                focusedField === "senhaAtual" && styles.focusedField,
              ]}
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
              {...focusHandlers("senhaAtual")}
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

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 48,
  },

  header: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
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
    marginTop: 28,
    marginBottom: 12,
  },

  card: {
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 16,
    paddingHorizontal: 17,
  },

  row: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  rowContent: {
    flex: 1,
    paddingRight: 16,
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

  credit: {
    color: Cores.textoSuave,
    fontSize: 10,
    textAlign: "center",
    marginTop: 22,
    marginBottom: 8,
  },

  separator: {
    height: 1,
    backgroundColor: Cores.borda,
    marginVertical: 2,
  },

  optionCard: {
    minHeight: 68,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  arrow: {
    color: Cores.textoSuave,
    fontSize: 22,
  },

  deleteCard: {
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.negativo,
    borderRadius: 14,
    padding: 18,
    marginTop: 18,
  },

  deleteTitle: {
    color: Cores.negativo,
    fontSize: 14,
    fontWeight: "700",
  },

  deleteDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 7,
    lineHeight: 19,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    backgroundColor: Cores.cartaoFundo,
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

  themeOption: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    paddingHorizontal: 14,
    marginTop: 10,
  },

  themeOptionSelected: {
    borderColor: Cores.bordaDestaque,
    backgroundColor: Cores.superficieMintSuave,
  },

  themeOptionCopy: {
    flex: 1,
  },

  themeOptionTitle: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "700",
  },

  themeOptionDescription: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 3,
  },

  themeOptionCheck: {
    color: Cores.textoPositivo,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
  },

  passwordInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    color: Cores.texto,
    paddingHorizontal: 14,
    marginTop: 16,
    outlineStyle: "solid",
    outlineWidth: 0,
  },

  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
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
