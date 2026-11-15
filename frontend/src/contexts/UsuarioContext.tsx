import {
  useCallback,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { router, useSegments } from "expo-router";

import { ApiError, authApi } from "@/services/api";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  saveSessionTokens,
  subscribeSessionExpired,
} from "@/services/authSession";
import {
  limparTokenPushSalvo,
  obterTokenPushSalvo,
} from "@/services/pushNotifications";
import { Usuario } from "@/types/usuario";

type DadosPerfil = Pick<Usuario, "nome" | "email" | "telefone">;

type UsuarioContexto = {
  usuario: Usuario | null;
  carregando: boolean;
  erroRestauracao: string | null;
  restaurarSessao: () => Promise<void>;
  login: (email: string, senha: string) => Promise<void>;
  logout: (revogarNoServidor?: boolean) => Promise<void>;
  atualizarPerfil: (dados: DadosPerfil) => void;
  atualizarSaldoTotal: (saldoTotal: number) => void;
};

const UsuarioContext = createContext<UsuarioContexto | undefined>(undefined);

function obterIniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UsuarioProvider({ children }: PropsWithChildren) {
  const segments = useSegments();
  const isAuthRoute = segments[0] === "(auth)";
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroRestauracao, setErroRestauracao] = useState<string | null>(null);

  const atualizarSaldoTotal = useCallback((saldoTotal: number) => {
    setUsuario((atual) => atual ? { ...atual, saldoTotal } : null);
  }, []);

  const restaurarSessao = useCallback(async () => {
    try {
      let token = await getAccessToken();
      setCarregando(true);
      setErroRestauracao(null);
      if (!token) token = await refreshAccessToken();
      if (!token) {
        setUsuario(null);
        return;
      }

      const { data } = await authApi.me();
      setUsuario({
        id: String(data.id),
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? "",
        iniciais: obterIniciais(data.nome),
        saldoTotal: Number(data.saldo_total),
      });
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 401) {
        await clearSessionTokens();
        setUsuario(null);
      } else {
        setErroRestauracao(
          erro instanceof Error
            ? erro.message
            : "Não foi possível verificar sua sessão. Tente novamente.",
        );
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (carregando || usuario || isAuthRoute) return;
    router.replace("/(auth)/login");
  }, [carregando, isAuthRoute, usuario]);

  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(() => {
      setUsuario(null);
      setErroRestauracao(null);
    });
    const restoreTimer = setTimeout(() => {
      void restaurarSessao();
    }, 0);
    return () => {
      clearTimeout(restoreTimer);
      unsubscribe();
    };
  }, [restaurarSessao]);

  const value = useMemo(
    () => ({
      usuario,
      carregando,
      erroRestauracao,
      restaurarSessao,
      atualizarSaldoTotal,

      login: async (email: string, senha: string) => {
        const { data } = await authApi.login(email, senha);
        await saveSessionTokens(data.token, data.refresh_token);
        setUsuario({
          id: String(data.user.id),
          nome: data.user.nome,
          email: data.user.email,
          telefone: "",
          iniciais: obterIniciais(data.user.nome),
          saldoTotal: Number(data.user.saldo_total),
        });
      },

      logout: async (revogarNoServidor = true) => {
        const falhas: string[] = [];
        try {
          if (revogarNoServidor) {
            const refresh = await getRefreshToken();
            const expoPushToken = await obterTokenPushSalvo();
            await authApi.logout(refresh, expoPushToken);
          }
        } catch (erro) {
          falhas.push(
            erro instanceof Error
              ? `Não foi possível revogar a sessão no servidor: ${erro.message}`
              : "Não foi possível revogar a sessão no servidor.",
          );
        }
        try {
          await limparTokenPushSalvo();
        } catch (erro) {
          falhas.push(
            erro instanceof Error
              ? `Não foi possível remover o token push local: ${erro.message}`
              : "Não foi possível remover o token push local.",
          );
        }
        try {
          await clearSessionTokens();
        } catch (erro) {
          falhas.push(
            erro instanceof Error
              ? `Não foi possível limpar as credenciais locais: ${erro.message}`
              : "Não foi possível limpar as credenciais locais.",
          );
        }
        setUsuario(null);
        if (falhas.length > 0) {
          throw new Error(
            `Sessão encerrada neste dispositivo. ${falhas.join(" ")}`,
          );
        }
      },

      atualizarPerfil: (dados: DadosPerfil) => {
        setUsuario((atual) =>
          atual
            ? {
                ...atual,
                ...dados,
                iniciais: obterIniciais(dados.nome) || atual.iniciais,
              }
            : null
        );
      },
    }),
    [usuario, carregando, erroRestauracao, restaurarSessao, atualizarSaldoTotal]
  );

  return (
    <UsuarioContext.Provider value={value}>{children}</UsuarioContext.Provider>
  );
}

export function useUsuario() {
  const contexto = useContext(UsuarioContext);
  if (!contexto)
    throw new Error("useUsuario deve ser usado dentro de UsuarioProvider.");
  return contexto;
}
