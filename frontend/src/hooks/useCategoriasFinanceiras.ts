import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { categoriasApi } from "@/services/api";
import type { Categoria } from "@/types/api";
import type { CategoriaOpcao } from "@/constants/financeCategories";

export function useCategoriasFinanceiras(
  tipo: "pessoal" | "grupo",
  padrao: readonly CategoriaOpcao[],
) {
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([...padrao]);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    categoriasApi.listar(tipo)
      .then(({ data }) => {
        if (!ativo) return;
        setCategorias(
          data.map((categoria: Categoria) => ({
            nome: categoria.nome,
            icone: categoria.icone || "📌",
          })),
        );
        setErro(null);
      })
      .catch((falha: unknown) => {
        if (ativo) {
          setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as categorias.");
        }
      });

    return () => {
      ativo = false;
    };
  }, [tipo]));

  return { categorias, erro };
}
