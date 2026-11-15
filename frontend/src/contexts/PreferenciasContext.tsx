import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Appearance, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

import { useUsuario } from "@/contexts/UsuarioContext";
import { notificacoesApi } from "@/services/api";
import {
  configurarSomNotificacoes,
  limparTokenPushSalvo,
  obterPlataformaPush,
  obterTokenPush,
  obterTokenPushSalvo,
} from "@/services/pushNotifications";

export type Preferencias = {
  notificacoes: boolean;
  som: boolean;
  tema: "Sistema" | "Claro" | "Escuro";
};

type PreferenciasContexto = {
  preferencias: Preferencias;
  carregando: boolean;
  atualizar: (atualizacao: Partial<Preferencias>) => Promise<void>;
};

const CHAVE_PREFERENCIAS = "@wepay:preferencias";
const PADRAO: Preferencias = {
  notificacoes: false,
  som: true,
  tema: "Sistema",
};

const PreferenciasContext = createContext<PreferenciasContexto | undefined>(
  undefined,
);

function aplicarTema(tema: Preferencias["tema"]) {
  Appearance.setColorScheme(
    tema === "Sistema" ? "auto" : tema.toLowerCase() as "light" | "dark",
  );
}

function normalizarPreferencias(valor: unknown): Preferencias {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return PADRAO;
  }
  const dados = valor as Partial<Preferencias>;
  return {
    notificacoes:
      typeof dados.notificacoes === "boolean"
        ? dados.notificacoes
        : PADRAO.notificacoes,
    som: typeof dados.som === "boolean" ? dados.som : PADRAO.som,
    tema:
      dados.tema === "Claro" || dados.tema === "Escuro"
        ? dados.tema
        : PADRAO.tema,
  };
}

export function PreferenciasProvider({ children }: PropsWithChildren) {
  const { usuario, carregando: carregandoUsuario } = useUsuario();
  const router = useRouter();
  const [preferencias, setPreferencias] = useState(PADRAO);
  const [carregandoLocal, setCarregandoLocal] = useState(true);
  const [usuarioSincronizado, setUsuarioSincronizado] = useState<string | null>(
    null,
  );
  const preferenciasRef = useRef(preferencias);
  const usuarioId = usuario?.id;
  const carregando =
    carregandoLocal
    || carregandoUsuario
    || (!!usuarioId && usuarioSincronizado !== usuarioId);

  useEffect(() => {
    preferenciasRef.current = preferencias;
  }, [preferencias]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const salvas = await AsyncStorage.getItem(CHAVE_PREFERENCIAS);
        if (salvas) {
          const carregadas = normalizarPreferencias(JSON.parse(salvas));
          if (ativo) setPreferencias(carregadas);
          aplicarTema(carregadas.tema);
        }
      } catch {
        Alert.alert(
          "Preferências indisponíveis",
          "Não foi possível carregar as configurações salvas neste dispositivo.",
        );
      } finally {
        if (ativo) setCarregandoLocal(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    configurarSomNotificacoes(preferencias.som);
  }, [preferencias.som]);

  useEffect(() => {
    if (carregandoLocal || carregandoUsuario) return;
    if (!usuarioId) return;

    const idUsuario = usuarioId;
    let ativo = true;

    async function sincronizarPreferencias() {
      try {
        const resposta = await notificacoesApi.obterPreferencias();
        const notificacoes = resposta.data.notificacoes;
        const som = resposta.data.sons;
        if (!ativo) return;

        const sincronizadas = {
          ...preferenciasRef.current,
          notificacoes,
          som,
        };
        preferenciasRef.current = sincronizadas;
        setPreferencias(sincronizadas);
        configurarSomNotificacoes(som);
        try {
          await AsyncStorage.setItem(
            CHAVE_PREFERENCIAS,
            JSON.stringify(sincronizadas),
          );
        } catch (erro) {
          console.error("Falha ao salvar preferências locais.", erro);
        }

        if (notificacoes && Platform.OS !== "web") {
          try {
            const token = await obterTokenPush(false);
            const plataforma = obterPlataformaPush();
            if (token && plataforma) {
              await notificacoesApi.registrarDispositivo(token, plataforma);
            }
          } catch (erro) {
            console.error("Falha ao registrar dispositivo para push.", erro);
            if (ativo) {
              Alert.alert(
                "Notificações push",
                "Não foi possível registrar este dispositivo. Confira a configuração do app e tente novamente em Configurações.",
              );
            }
          }
        } else if (!notificacoes) {
          const tokenSalvo = await obterTokenPushSalvo();
          if (tokenSalvo) {
            try {
              await notificacoesApi.removerDispositivo(tokenSalvo);
              await limparTokenPushSalvo();
            } catch (erro) {
              console.error(
                "Falha ao remover dispositivo de push com notificações desativadas.",
                erro,
              );
            }
          }
        }
      } catch (erro) {
        console.error("Falha ao sincronizar preferências.", erro);
        if (ativo) {
          Alert.alert(
            "Notificações",
            "Não foi possível sincronizar suas preferências com o servidor.",
          );
        }
      } finally {
        if (ativo) setUsuarioSincronizado(idUsuario);
      }
    }

    void sincronizarPreferencias();
    return () => {
      ativo = false;
    };
  }, [carregandoLocal, carregandoUsuario, usuarioId]);

  useEffect(() => {
    let respostaTratada: string | null = null;
    function abrirNotificacao(
      resposta: Notifications.NotificationResponse,
    ) {
      const identificador = resposta.notification.request.identifier;
      if (identificador === respostaTratada) return;
      respostaTratada = identificador;
      void Notifications.clearLastNotificationResponseAsync();

      const dados = resposta.notification.request.content.data;
      if (!dados || typeof dados !== "object") return;
      const conteudo = dados as Record<string, unknown>;
      const groupId = conteudo.groupId;
      const grupoNome = conteudo.grupoNome;
      if (
        conteudo.tipo === "nova_despesa"
        && (typeof groupId === "string" || typeof groupId === "number")
        && typeof grupoNome === "string"
      ) {
        router.push({
          pathname: "/(main)/group/despesas-grupo",
          params: { groupId: String(groupId), grupoNome },
        });
      }
    }

    const assinatura =
      Notifications.addNotificationResponseReceivedListener(abrirNotificacao);
    let ativo = true;
    void Notifications.getLastNotificationResponseAsync().then((resposta) => {
      if (ativo && resposta) abrirNotificacao(resposta);
    });

    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, [router]);

  async function atualizar(atualizacao: Partial<Preferencias>) {
    const anteriores = preferencias;
    const novas = { ...anteriores, ...atualizacao };
    let token: string | null = null;
    let erroRemocaoDispositivo = false;
    const alterouNotificacoes =
      atualizacao.notificacoes !== undefined
      || atualizacao.som !== undefined;
    const desativouNotificacoes =
      usuario
      && anteriores.notificacoes
      && atualizacao.notificacoes === false;

    try {
      if (
        usuario
        && atualizacao.notificacoes === true
        && !anteriores.notificacoes
      ) {
        const plataforma = obterPlataformaPush();
        token = await obterTokenPush(true);
        if (plataforma && !token) {
          Alert.alert(
            "Permissão necessária",
            "Permita notificações do WePay nas configurações do dispositivo para ativar os avisos push.",
          );
          return;
        }
        if (token && plataforma) {
          await notificacoesApi.registrarDispositivo(token, plataforma);
        }
      }

      if (usuario && alterouNotificacoes) {
        await notificacoesApi.atualizarPreferencias(
          novas.notificacoes,
          novas.som,
        );
      }
      if (desativouNotificacoes) {
        const tokenSalvo = await obterTokenPushSalvo();
        if (tokenSalvo) {
          try {
            await notificacoesApi.removerDispositivo(tokenSalvo);
            await limparTokenPushSalvo();
          } catch (erro) {
              erroRemocaoDispositivo = true;
            console.error("Falha ao remover dispositivo de push.", erro);
          }
        }
      }
    } catch (erro) {
      Alert.alert(
        "Não foi possível atualizar",
        erro instanceof Error
          ? erro.message
          : "Verifique sua conexão e tente novamente.",
      );
      return;
    }

    setPreferencias(novas);
    if (atualizacao.tema) aplicarTema(atualizacao.tema);
    configurarSomNotificacoes(novas.som);
    try {
      await AsyncStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(novas));
    } catch {
      Alert.alert(
        "Preferências não salvas neste dispositivo",
        "As alterações de notificações foram sincronizadas com sua conta, mas não puderam ser salvas localmente.",
      );
    }
    if (erroRemocaoDispositivo) {
      Alert.alert(
        "Notificações desativadas",
        "A preferência foi desativada, mas não foi possível remover este dispositivo do servidor.",
      );
    }
  }

  return (
    <PreferenciasContext.Provider
      value={{ preferencias, carregando, atualizar }}
    >
      {children}
    </PreferenciasContext.Provider>
  );
}

export function usePreferencias() {
  const contexto = useContext(PreferenciasContext);
  if (!contexto) {
    throw new Error(
      "usePreferencias deve ser usado dentro de PreferenciasProvider.",
    );
  }
  return contexto;
}
