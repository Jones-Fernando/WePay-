/**
 * ============================================================
 * WEPAY - GERENCIAMENTO DE PERFIL
 * ============================================================
 *
 * Esta tela permite ao usuário:
 *
 * - visualizar seus dados;
 * - alterar nome;
 * - alterar e-mail;
 * - alterar telefone;
 * - salvar alterações;
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
 * FLUXO ATUAL:
 *
 * Tela
 *   ↓
 * estado local
 *   ↓
 * validação
 *   ↓
 * simulação
 *
 *
 * FLUXO FUTURO:
 *
 * gerenciamento-perfil.tsx
 *          ↓
 * src/services/api.ts
 *          ↓
 * Flask
 *          ↓
 * MySQL
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
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { useUsuario } from "@/contexts/UsuarioContext";


/**
 * ============================================================
 * COMPONENTE PRINCIPAL
============================================================ */

export default function GerenciamentoPerfilScreen() {
  const { usuario, atualizarPerfil } = useUsuario();

  /**
   * ==========================================================
   * ESTADOS DO FORMULÁRIO
   ========================================================== */

  /**
   * Nome atual do usuário.
   *
   * Como ainda estamos trabalhando com frontend/mock,
   * iniciamos o campo com o mesmo usuário utilizado
   * como referência nas telas existentes.
   */
  const [nome, setNome] = useState(usuario.nome);


  /**
   * E-mail do usuário.
   */
  const [email, setEmail] =
    useState(usuario.email);


  /**
   * Telefone do usuário.
   *
   * Neste primeiro momento é apenas um dado visual/mock.
   */
  const [telefone, setTelefone] =
    useState(usuario.telefone);


  /**
   * Controla o estado de carregamento do botão
   * "Salvar alterações".
   */
  const [salvando, setSalvando] =
    useState(false);


  /**
   * ==========================================================
   * FUNÇÃO DE VALIDAÇÃO DE E-MAIL
   ========================================================== */

  /**
   * Verifica se o e-mail possui uma estrutura básica.
   */
  function emailValido(valor: string): boolean {

    return /\S+@\S+\.\S+/.test(valor);

  }


  /**
   * ==========================================================
   * FUNÇÃO DE SALVAR
   ========================================================== */

  async function salvarAlteracoes() {

    /**
     * Remove espaços desnecessários do nome.
     */
    const nomeLimpo = nome.trim();


    /**
     * Remove espaços desnecessários do e-mail.
     */
    const emailLimpo = email.trim();


    /**
     * ========================================================
     * VALIDAÇÃO DO NOME
     ======================================================== */

    if (!nomeLimpo) {

      Alert.alert(
        "Atenção",
        "Digite seu nome."
      );

      return;
    }


    /**
     * Evita nomes muito curtos.
     */
    if (nomeLimpo.length < 3) {

      Alert.alert(
        "Atenção",
        "O nome precisa ter pelo menos 3 caracteres."
      );

      return;
    }


    /**
     * ========================================================
     * VALIDAÇÃO DO E-MAIL
     ======================================================== */

    if (!emailLimpo) {

      Alert.alert(
        "Atenção",
        "Digite seu e-mail."
      );

      return;
    }


    /**
     * Verifica se o e-mail possui um formato válido.
     */
    if (!emailValido(emailLimpo)) {

      Alert.alert(
        "Atenção",
        "Digite um e-mail válido."
      );

      return;
    }


    /**
     * ========================================================
     * PROCESSAMENTO
     ======================================================== */

    try {

      /**
       * Ativa o estado de carregamento.
       */
      setSalvando(true);


      /**
       * ======================================================
       * FUTURA INTEGRAÇÃO COM O BACKEND
       * ======================================================
       *
       * Quando o backend estiver pronto, aqui deverá ocorrer
       * a chamada ao serviço:
       *
       * await api.put(
       *   "/api/auth/perfil",
       *   {
       *     nome: nomeLimpo,
       *     email: emailLimpo,
       *     telefone,
       *   }
       * );
       *
       * A tela não deve chamar o Flask diretamente.
       *
       * O correto será:
       *
       * tela
       *   ↓
       * services/api.ts
       *   ↓
       * Flask
       */


      /**
       * ------------------------------------------------------
       * SIMULAÇÃO TEMPORÁRIA
       * ------------------------------------------------------
       *
       * Usamos um pequeno atraso apenas para reproduzir
       * o comportamento de uma requisição.
       */

      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );

      atualizarPerfil({
        nome: nomeLimpo,
        email: emailLimpo,
        telefone: telefone.trim(),
      });


      /**
       * Mostra mensagem de sucesso.
       */
      Alert.alert(
        "Perfil atualizado",
        "Suas informações foram atualizadas com sucesso."
      );

    } catch {

      /**
       * Caso aconteça algum erro.
       */
      Alert.alert(
        "Erro",
        "Não foi possível atualizar seu perfil."
      );

    } finally {

      /**
       * O finally executa tanto em sucesso quanto em erro.
       *
       * Portanto, sempre removemos o estado de carregamento.
       */
      setSalvando(false);

    }

  }


  /**
   * ==========================================================
   * FUNÇÃO ALTERAR SENHA
   ========================================================== */

  function alterarSenha() {
    router.push("/(main)/alterar-senha");

  }


  /**
   * ==========================================================
   * FUNÇÃO SAIR
   ========================================================== */

  function sairDaConta() {

    /**
     * Antes de sair, pedimos confirmação ao usuário.
     *
     * O Alert possui dois botões:
     *
     * Cancelar
     * Sair
     */

    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair da sua conta?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },

        {
          text: "Sair",

          /**
           * Aqui ficará futuramente a remoção do token
           * armazenado no dispositivo.
           *
           * Exemplo futuro:
           *
           * await storage.removeToken();
           */

          onPress: () => {

            /**
             * Depois do logout,
             * retornamos para o login.
             */
            router.replace(
              "/(auth)/login"
            );

          },
        },
      ]
    );

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

              <Text style={styles.profileAvatarText}>
                {usuario.iniciais}
              </Text>

            </View>


            {/* -------------------------------------------------
                NOME
            -------------------------------------------------- */}

            <Text style={styles.profileName}>
              {nome || "Seu nome"}
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
              style={styles.photoButton}
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  "Foto de perfil",
                  "A alteração da foto será implementada posteriormente."
                )
              }
            >

              <Text style={styles.photoButtonText}>
                Alterar foto
              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: INFORMAÇÕES PESSOAIS
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Informações pessoais
            </Text>


            {/* -------------------------------------------------
                NOME
            -------------------------------------------------- */}

            <View style={styles.field}>

              <Text style={styles.label}>
                Nome
              </Text>


              <TextInput
                style={styles.input}

                /**
                 * Valor atual do campo.
                 */
                value={nome}

                /**
                 * Atualiza o estado sempre que
                 * o usuário digitar.
                 */
                onChangeText={setNome}

                placeholder="Digite seu nome"
                placeholderTextColor="#6B8F86"

                /**
                 * Como o nome é textual,
                 * utilizamos capitalização de palavras.
                 */
                autoCapitalize="words"

                autoCorrect={false}
              />

            </View>


            {/* -------------------------------------------------
                E-MAIL
            -------------------------------------------------- */}

            <View style={styles.field}>

              <Text style={styles.label}>
                E-mail
              </Text>


              <TextInput
                style={styles.input}

                value={email}

                onChangeText={setEmail}

                placeholder="seu@email.com"

                placeholderTextColor="#6B8F86"

                /**
                 * Teclado apropriado para e-mail.
                 */
                keyboardType="email-address"

                /**
                 * Evita alteração automática para
                 * letras maiúsculas.
                 */
                autoCapitalize="none"

                autoCorrect={false}
              />

            </View>


            {/* -------------------------------------------------
                TELEFONE
            -------------------------------------------------- */}

            <View style={styles.field}>

              <Text style={styles.label}>
                Telefone
              </Text>


              <TextInput
                style={styles.input}

                value={telefone}

                onChangeText={setTelefone}

                placeholder="(00) 00000-0000"

                placeholderTextColor="#6B8F86"

                keyboardType="phone-pad"

                /**
                 * Não aplicamos máscara automática aqui.
                 *
                 * A máscara pode ser adicionada posteriormente
                 * em utils/mask.ts, caso você mantenha essa
                 * pasta na evolução da arquitetura.
                 */
              />

            </View>


            {/* =================================================
                BOTÃO SALVAR
            ================================================== */}

            <TouchableOpacity
              style={[
                styles.saveButton,

                /**
                 * Durante salvamento o botão fica
                 * visualmente mais discreto.
                 */
                salvando &&
                  styles.saveButtonDisabled,
              ]}

              /**
               * Evita executar novamente enquanto
               * uma operação estiver em andamento.
               */
              disabled={salvando}

              onPress={salvarAlteracoes}

              activeOpacity={0.8}
            >

              <Text style={styles.saveButtonText}>

                {salvando
                  ? "Salvando..."
                  : "Salvar alterações"}

              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: SEGURANÇA
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Segurança
            </Text>


            {/* -------------------------------------------------
                ALTERAR SENHA
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.optionCard}
              onPress={alterarSenha}
              activeOpacity={0.7}
            >

              <View style={styles.optionIcon}>

                <Text style={styles.optionIconText}>
                  🔒
                </Text>

              </View>


              <View style={styles.optionContent}>

                <Text style={styles.optionTitle}>
                  Alterar senha
                </Text>

                <Text style={styles.optionDescription}>
                  Atualize a senha da sua conta
                </Text>

              </View>


              <Text style={styles.optionArrow}>
                ›
              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: CONTA
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Conta
            </Text>

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


            {/* -------------------------------------------------
                SAIR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={sairDaConta}
              activeOpacity={0.7}
            >

              <Text style={styles.logoutIcon}>
                ↪
              </Text>

              <Text style={styles.logoutText}>
                Sair da conta
              </Text>

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

const styles = StyleSheet.create({

  /* ==========================================================
     CONTAINER PRINCIPAL
  ========================================================== */

  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },


  keyboard: {
    flex: 1,
  },


  screen: {
    flex: 1,
    backgroundColor: "#F5FBF7",
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

    backgroundColor: "#FFFFFF",

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: "#E1EEE8",
  },


  backText: {
    color: "#0B3B33",

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

    color: "#0B3B33",
  },


  headerSubtitle: {
    marginTop: 2,

    fontSize: 10.5,

    color: "#6B8F86",
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

    backgroundColor: "#0B3B33",

    justifyContent: "center",
    alignItems: "center",
  },


  profileAvatarText: {
    color: "#FFFFFF",

    fontSize: 24,

    fontWeight: "800",
  },


  profileName: {
    marginTop: 12,

    fontSize: 19,

    fontWeight: "700",

    color: "#0B3B33",
  },


  profileDescription: {
    marginTop: 4,

    fontSize: 11,

    color: "#6B8F86",
  },


  photoButton: {
    marginTop: 10,

    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: "#F0F8F4",

    borderWidth: 1,
    borderColor: "#E1EEE8",
  },


  photoButtonText: {
    fontSize: 11,

    fontWeight: "700",

    color: "#00A17A",
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

    color: "#0B3B33",
  },


  /* ==========================================================
     CAMPOS
  ========================================================== */

  field: {
    marginBottom: 12,
  },


  label: {
    marginBottom: 6,

    fontSize: 11,

    fontWeight: "600",

    color: "#6B8F86",
  },


  input: {
    minHeight: 50,

    paddingHorizontal: 13,

    borderRadius: 12,

    backgroundColor: "#F0F8F4",

    borderWidth: 1,
    borderColor: "#E1EEE8",

    fontSize: 13,

    color: "#0B3B33",
  },


  /* ==========================================================
     BOTÃO SALVAR
  ========================================================== */

  saveButton: {
    minHeight: 50,

    marginTop: 6,

    borderRadius: 12,

    backgroundColor: "#00C896",

    justifyContent: "center",
    alignItems: "center",
  },


  saveButtonDisabled: {
    opacity: 0.6,
  },


  saveButtonText: {
    fontSize: 13,

    fontWeight: "700",

    color: "#0B3B33",
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

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E1EEE8",
  },


  optionIcon: {
    width: 40,
    height: 40,

    borderRadius: 12,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#F0F8F4",
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

    color: "#0B3B33",
  },


  optionDescription: {
    marginTop: 3,

    fontSize: 10,

    color: "#6B8F86",
  },


  optionArrow: {
    marginLeft: 8,

    fontSize: 25,

    fontWeight: "300",

    color: "#6B8F86",
  },


  /* ==========================================================
     SAIR
  ========================================================== */

  logoutButton: {
    minHeight: 50,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    borderWidth: 1,

    borderColor: "#FFB5AA",

    backgroundColor: "#FFF7F5",
  },


  logoutIcon: {
    marginRight: 8,

    fontSize: 18,

    color: "#D24A3B",
  },


  logoutText: {
    fontSize: 13,

    fontWeight: "700",

    color: "#D24A3B",
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

    color: "#6B8F86",
  },


  versionNumber: {
    marginTop: 3,

    fontSize: 9,

    color: "#6B8F86",
  },
});
