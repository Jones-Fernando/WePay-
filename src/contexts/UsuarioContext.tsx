import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "@/services/api";
import { Usuario } from "@/types/usuario";

type DadosPerfil = Pick<Usuario, "nome" | "email" | "telefone">;

type UsuarioContexto = {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  atualizarPerfil: (dados: DadosPerfil) => void;
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
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function restaurarSessao() {
      try {
        const token = await AsyncStorage.getItem("@wepay:token");
        if (!token) return;

        let perfil;

        try {
          perfil = await authApi.me();
        } catch {
          const refreshToken = await AsyncStorage.getItem("@wepay:refresh_token");
          if (!refreshToken) throw new Error("Sessão expirada.");

          const { data: sessaoRenovada } = await authApi.refresh(refreshToken);
          await AsyncStorage.multiSet([
            ["@wepay:token", sessaoRenovada.token],
            ["@wepay:refresh_token", sessaoRenovada.refresh_token],
          ]);
          perfil = await authApi.me();
        }

        const { data } = perfil;
        setUsuario({
          id: String(data.id),
          nome: data.nome,
          email: data.email,
          telefone: data.telefone ?? "",
          iniciais: obterIniciais(data.nome),
          saldoTotal: 0,
        });
      } catch {
        await AsyncStorage.multiRemove(["@wepay:token", "@wepay:refresh_token"]);
      } finally {
        setCarregando(false);
      }
    }

    restaurarSessao();
  }, []);

  const value = useMemo(
    () => ({
      usuario,
      carregando,

      login: async (email: string, senha: string) => {
        const { data } = await authApi.login(email, senha);
        await AsyncStorage.multiSet([
          ["@wepay:token", data.token],
          ["@wepay:refresh_token", data.refresh_token],
        ]);
        setUsuario({
          id: String(data.user.id),
          nome: data.user.nome,
          email: data.user.email,
          telefone: "",
          iniciais: obterIniciais(data.user.nome),
          saldoTotal: 0,
        });
      },

      logout: async () => {
        try {
          const refresh = await AsyncStorage.getItem("@wepay:refresh_token");
          if (refresh) await authApi.logout(refresh);
        } catch {
          // ignora erro de rede no logout
        } finally {
          await AsyncStorage.multiRemove(["@wepay:token", "@wepay:refresh_token"]);
          setUsuario(null);
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
    [usuario, carregando]
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
