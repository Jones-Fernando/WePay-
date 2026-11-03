import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authApi } from "@/services/api";

type EstadoConfirmacao = "carregando" | "confirmado" | "erro";

export default function VerificarEmail() {
  const { token, convite } = useLocalSearchParams<{
    token?: string;
    convite?: string;
  }>();
  const tokenConfirmacao = Array.isArray(token) ? token[0] : token;
  const conviteToken = Array.isArray(convite) ? convite[0] : convite;
  const confirmacaoAtual = useRef<{
    token: string;
    promessa: Promise<void>;
  } | null>(null);
  const [estado, setEstado] = useState<EstadoConfirmacao>("carregando");
  const [mensagemErro, setMensagemErro] = useState("");
  const estadoVisivel = tokenConfirmacao ? estado : "erro";
  const mensagemVisivel = tokenConfirmacao
    ? mensagemErro
    : "Este link não possui um token de confirmação válido.";

  useEffect(() => {
    if (!tokenConfirmacao) return;

    let ativa = true;
    if (confirmacaoAtual.current?.token !== tokenConfirmacao) {
      confirmacaoAtual.current = {
        token: tokenConfirmacao,
        promessa: authApi
          .confirmarEmail(tokenConfirmacao)
          .then(() => undefined),
      };
    }

    const confirmacao = confirmacaoAtual.current;
    if (!confirmacao) return;
    confirmacao.promessa
      .then(() => {
        if (ativa) setEstado("confirmado");
      })
      .catch((erro: unknown) => {
        if (!ativa) return;
        setMensagemErro(
          erro instanceof Error
            ? erro.message
            : "Não foi possível confirmar seu e-mail."
        );
        setEstado("erro");
      });

    return () => {
      ativa = false;
    };
  }, [tokenConfirmacao]);

  function continuar() {
    if (conviteToken) {
      router.replace(`/convite?token=${encodeURIComponent(conviteToken)}` as never);
      return;
    }
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View
          style={[
            styles.icon,
            estadoVisivel === "erro" && styles.errorIcon,
          ]}
        >
          {estadoVisivel === "carregando" ? (
            <ActivityIndicator size="large" color="#00A17A" />
          ) : (
            <Text style={styles.iconText}>
              {estadoVisivel === "confirmado" ? "✓" : "!"}
            </Text>
          )}
        </View>

        <Text style={styles.title}>
          {estadoVisivel === "carregando"
            ? "Confirmando seu e-mail"
            : estadoVisivel === "confirmado"
              ? "E-mail confirmado"
              : "Não foi possível confirmar"}
        </Text>
        <Text style={styles.description}>
          {estadoVisivel === "carregando"
            ? "Estamos validando seu link. Isso pode levar alguns segundos."
            : estadoVisivel === "confirmado"
              ? "Sua conta está ativa. Agora você já pode entrar no WePay."
              : mensagemVisivel}
        </Text>

        {estadoVisivel !== "carregando" ? (
          <TouchableOpacity
            style={styles.button}
            onPress={continuar}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {conviteToken ? "Continuar com o convite" : "Ir para o login"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF6ED",
    marginBottom: 22,
  },
  errorIcon: {
    backgroundColor: "#FCE8E6",
  },
  iconText: {
    color: "#0B3B33",
    fontSize: 38,
    fontWeight: "700",
  },
  title: {
    color: "#0B3B33",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    color: "#6B8F86",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 340,
  },
  button: {
    minHeight: 52,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C896",
    borderRadius: 12,
    marginTop: 28,
  },
  buttonText: {
    color: "#0B3B33",
    fontSize: 15,
    fontWeight: "700",
  },
});
