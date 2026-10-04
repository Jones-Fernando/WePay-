import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

import { usuarioMockado } from "@/constants/DadosMocados";
import { Usuario } from "@/types/usuario";

type DadosPerfil = Pick<Usuario, "nome" | "email" | "telefone">;

type UsuarioContexto = {
  usuario: Usuario;
  atualizarPerfil: (dados: DadosPerfil) => void;
};

const UsuarioContext = createContext<UsuarioContexto | undefined>(undefined);

function obterIniciais(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase()).join("");
}

export function UsuarioProvider({ children }: PropsWithChildren) {
  const [usuario, setUsuario] = useState<Usuario>(usuarioMockado);

  const value = useMemo(() => ({
    usuario,
    atualizarPerfil: (dados: DadosPerfil) => {
      setUsuario((atual) => ({
        ...atual,
        ...dados,
        iniciais: obterIniciais(dados.nome) || atual.iniciais,
      }));
    },
  }), [usuario]);

  return <UsuarioContext.Provider value={value}>{children}</UsuarioContext.Provider>;
}

export function useUsuario() {
  const contexto = useContext(UsuarioContext);
  if (!contexto) throw new Error("useUsuario deve ser usado dentro de UsuarioProvider.");
  return contexto;
}
