import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/**
 * ============================================================
 * WEPAY - GERENCIAMENTO DE PERFIL
 * ============================================================
 *
 * Esta tela permite ao usuário:
 *
 * - visualizar seus dados;
 * - abrir a edição das informações pessoais;
 * - acessar a alteração de senha;
 * - sair da conta.
 *
 *
 * IMPORTANTE
 * ------------------------------------------------------------
 *
 * Esta tela segue o mesmo padrão de programação utilizado
 * pelo projeto enviado no ZIP:
 *
 * - React + useState;
 * - componentes do React Native;
 * - TouchableOpacity;
 * - TextInput;
 * - Alert;
 * - ScrollView;
 * - StyleSheet;
 * - navegação com Expo Router.
 *
 *
 * Os dados do perfil são carregados e salvos pela API.
 */


/* ============================================================
   IMPORTS
============================================================ */

/**
 * React e useState:
 *
 * useState será utilizado para armazenar os dados
 * digitados pelo usuário.
 */
import React, { useState } from "react";


/**
 * Componentes básicos do React Native.
 */
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";


/**
 * SafeAreaView mantém o conteúdo dentro da área segura
 * do celular.
 */
import { SafeAreaView } from "react-native-safe-area-context";


/**
 * Expo Router permite navegar entre as telas.
 */
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useUsuario } from "@/contexts/UsuarioContext";
import { authApi } from "@/services/api";
import { Alert } from "@/services/feedback";


/**
 * ============================================================
 * COMPONENTE PRINCIPAL
============================================================ */

export default function GerenciamentoPerfilScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { usuario, atualizarPerfil, logout } = useUsuario();
  const usuarioAtual = usuario ?? {
    id: "",
    nome: "",
    email: "",
    telefone: "",
    pixChave: "",
    iniciais: "",
    saldoTotal: 0,
  };

  const [alterandoFoto, setAlterandoFoto] =
    useState(false);

  async function selecionarFotoPerfil() {
    if (alterandoFoto) return;
    setAlterandoFoto(true);

    try {
      if (Platform.OS !== "web") {
        const permissao =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissao.granted) {
          Alert.alert(
            "Permissão necessária",
            "Permita o acesso às fotos para escolher uma imagem de perfil.",
          );
          return;
        }
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (resultado.canceled || !resultado.assets[0]) return;

      const imagemBase64 = resultado.assets[0].base64;
      if (!imagemBase64) {
        Alert.alert(
          "Foto inválida",
          "Não foi possível ler a imagem selecionada. Escolha outra foto.",
        );
        return;
      }

      try {
        const resposta = await authApi.atualizarAvatar(imagemBase64);
        atualizarPerfil({ avatarUrl: resposta.data.avatar_url });
      } catch {
        // A camada da API já exibe o erro de operações CRUD.
        return;
      }
    } catch (erro) {
      Alert.alert(
        "Foto não atualizada",
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar sua foto de perfil.",
      );
    } finally {
      setAlterandoFoto(false);
    }
  }


  /**
   * ==========================================================
   * FUNÇÃO ALTERAR SENHA
   ========================================================== */

  function abrirInformacoesPessoais() {
    router.push("/(main)/informacoes-pessoais");
  }

  function alterarSenha() {
    router.push("/(main)/alterar-senha");

  }


  /**
   * ==========================================================
   * FUNÇÃO SAIR
   ========================================================== */

  async function confirmarSaida() {
    try {
      await logout();
    } catch (erro) {
      Alert.alert(
        "Sessão encerrada",
        erro instanceof Error
          ? erro.message
          : "A sessão local foi encerrada, mas o servidor não confirmou a revogação.",
      );
    }
    router.replace("/(auth)/login");
  }

  function sairDaConta() {
    const mensagem = "Tem certeza que deseja sair da sua conta?";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(mensagem)) {
        void confirmarSaida();
      }
      return;
    }

    Alert.alert("Sair da conta", mensagem, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", onPress: () => void confirmarSaida() },
    ]);
  }


  /**
   * ==========================================================
   * INTERFACE
   ========================================================== */

  return (

    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >

        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* =================================================
              CABEÇALHO
          ================================================== */}

          <View style={styles.header}>

            {/* -------------------------------------------------
                BOTÃO VOLTAR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >

              <Text style={styles.backText}>
                ←
              </Text>

            </TouchableOpacity>


            {/* -------------------------------------------------
                TÍTULO
            -------------------------------------------------- */}

            <View style={styles.headerCenter}>

              <Text style={styles.headerTitle}>
                Meu perfil
              </Text>

              <Text style={styles.headerSubtitle}>
                Gerencie suas informações
              </Text>

            </View>


            {/* 
              Espaço vazio do lado direito.
              Ele serve para manter o título centralizado.
            */}

            <View style={styles.headerSpace} />

          </View>

          {/* =================================================
              PERFIL / AVATAR
          ================================================== */}

          <View style={styles.profileHeader}>

            {/* -------------------------------------------------
                AVATAR
            -------------------------------------------------- */}

            <View style={styles.profileAvatar}>

              {usuarioAtual.avatarUrl ? (
                <Image
                  accessibilityLabel="Foto de perfil"
                  source={{ uri: usuarioAtual.avatarUrl }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {usuarioAtual.iniciais || "?"}
                </Text>
              )}

            </View>


            {/* -------------------------------------------------
                NOME
            -------------------------------------------------- */}

            <Text style={styles.profileName}>
              {usuarioAtual.nome || "Seu nome"}
            </Text>


            {/* -------------------------------------------------
                DESCRIÇÃO
            -------------------------------------------------- */}

            <Text style={styles.profileDescription}>
              Conta pessoal WEPAY
            </Text>


            {/* -------------------------------------------------
                BOTÃO AVATAR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={[
                styles.photoButton,
                alterandoFoto && styles.photoButtonDisabled,
              ]}
              disabled={alterandoFoto}
              activeOpacity={0.7}
              onPress={() => void selecionarFotoPerfil()}
            >

              {alterandoFoto ? (
                <ActivityIndicator size="small" color={Cores.textoPositivo} />
              ) : (
                <Text style={styles.photoButtonText}>
                  {usuarioAtual.avatarUrl ? "Alterar foto" : "Adicionar foto"}
                </Text>
              )}

            </TouchableOpacity>

          </View>


          <View style={styles.section}>
            <View style={styles.optionGroupSpacing}>
              <Text style={styles.sectionTitle}>Perfil</Text>
              <TouchableOpacity
                testID="personal-info-option"
                style={styles.optionCard}
                onPress={abrirInformacoesPessoais}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>👤</Text>
                </View>

                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Informações pessoais</Text>
                  <Text style={styles.optionDescription}>
                    Nome, e-mail e chave Pix
                  </Text>
                </View>

                <Text style={styles.optionArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.optionGroupSpacing}>
              <Text style={styles.sectionTitle}>Segurança</Text>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={alterarSenha}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>🔒</Text>
                </View>

                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Alterar senha</Text>
                  <Text style={styles.optionDescription}>
                    Atualize a senha da sua conta
                  </Text>
                </View>

                <Text style={styles.optionArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Conta</Text>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => router.push("/(main)/configuracoes")}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>⚙️</Text>
                </View>

                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Configurações</Text>
                  <Text style={styles.optionDescription}>
                    Notificações, tema e privacidade
                  </Text>
                </View>

                <Text style={styles.optionArrow}>›</Text>
              </TouchableOpacity>
            </View>

          </View>


          <View style={styles.section}>

            {/* -------------------------------------------------
                SAIR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.optionCard}
              onPress={sairDaConta}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>↪</Text>
              </View>

              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Sair da conta</Text>
                <Text style={styles.optionDescription}>
                  Desconecte sua conta deste dispositivo.
                </Text>
              </View>

              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>

          </View>


          {/* =================================================
              VERSÃO
          ================================================== */}

          <View style={styles.versionArea}>

            <Text style={styles.versionText}>
              WEPAY
            </Text>

            <Text style={styles.versionNumber}>
              Versão 1.0.0
            </Text>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}


/**
 * ============================================================
 * ESTILOS
 * ============================================================
 *
 * Os estilos seguem a mesma linguagem visual do projeto ZIP:
 *
 * Fundo:
 * #F5FBF7
 *
 * Tinta:
 * #0B3B33
 *
 * Verde:
 * #00C896
 *
 * Verde escuro:
 * #00A17A
 *
 * Texto suave:
 * #6B8F86
 *
 * Linha:
 * #E1EEE8
 *
 * Campo:
 * #F0F8F4
 */


/* ============================================================
   STYLE SHEET
============================================================ */

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({

  /* ==========================================================
     CONTAINER PRINCIPAL
  ========================================================== */

  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },


  keyboard: {
    flex: 1,
  },


  screen: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },


  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },


  /* ==========================================================
     CABEÇALHO
  ========================================================== */

  header: {
    height: 65,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    marginBottom: 10,
  },


  backButton: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor: Cores.cartaoFundo,

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: Cores.borda,
  },


  backText: {
    color: Cores.texto,

    fontSize: 28,

    fontWeight: "300",

    lineHeight: 32,
  },


  headerCenter: {
    flex: 1,

    alignItems: "center",

    paddingHorizontal: 10,
  },


  headerTitle: {
    fontSize: 18,

    fontWeight: "700",

    color: Cores.texto,
  },


  headerSubtitle: {
    marginTop: 2,

    fontSize: 10.5,

    color: Cores.textoSuave,
  },


  headerSpace: {
    width: 42,
  },


  /* ==========================================================
     CABEÇALHO DO PERFIL
  ========================================================== */

  profileHeader: {
    alignItems: "center",

    paddingTop: 12,

    paddingBottom: 24,
  },


  profileAvatar: {
    width: 84,
    height: 84,

    borderRadius: 28,

    backgroundColor: Cores.superficieMarca,

    justifyContent: "center",
    alignItems: "center",
  },


  profileAvatarText: {
    color: Cores.textoSobreMarca,

    fontSize: 24,

    fontWeight: "800",
  },

  profileAvatarImage: {
    width: 84,
    height: 84,
    borderRadius: 28,
  },


  profileName: {
    marginTop: 12,

    fontSize: 19,

    fontWeight: "700",

    color: Cores.texto,
  },


  profileDescription: {
    marginTop: 4,

    fontSize: 11,

    color: Cores.textoSuave,
  },


  photoButton: {
    marginTop: 10,

    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: Cores.fundoCampo,

    borderWidth: 1,
    borderColor: Cores.borda,
  },

  photoButtonDisabled: {
    opacity: 0.6,
  },


  photoButtonText: {
    fontSize: 11,

    fontWeight: "700",

    color: Cores.textoPositivo,
  },


  /* ==========================================================
     SEÇÕES
  ========================================================== */

  section: {
    marginTop: 8,

    marginBottom: 20,
  },


  sectionTitle: {
    marginBottom: 10,

    fontSize: 14,

    fontWeight: "700",

    color: Cores.texto,
  },

  optionGroupSpacing: {
    marginBottom: 12,
  },

  /* ==========================================================
     OPÇÕES
  ========================================================== */

  optionCard: {
    minHeight: 68,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 12,
    paddingVertical: 10,

    borderRadius: 14,

    backgroundColor: Cores.cartaoFundo,

    borderWidth: 1,
    borderColor: Cores.borda,
  },


  optionIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },


  optionIconText: {
    fontSize: 18,
  },


  optionContent: {
    flex: 1,

    marginLeft: 10,
  },


  optionTitle: {
    fontSize: 12,

    fontWeight: "700",

    color: Cores.texto,
  },


  optionDescription: {
    marginTop: 3,

    fontSize: 10,

    color: Cores.textoSuave,
  },


  optionArrow: {
    marginLeft: 8,

    fontSize: 25,

    fontWeight: "300",

    color: Cores.textoSuave,
  },


  /* ==========================================================
     VERSÃO
  ========================================================== */

  versionArea: {
    alignItems: "center",

    paddingTop: 5,

    paddingBottom: 10,
  },


  versionText: {
    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 1.5,

    color: Cores.textoSuave,
  },


  versionNumber: {
    marginTop: 3,

    fontSize: 9,

    color: Cores.textoSuave,
  },
});
