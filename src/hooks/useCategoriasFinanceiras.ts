import { useEffect, useState } from "react";
import { categoriasApi } from "@/services/api";
import {
  mesclarCategorias,
  type CategoriaOpcao,
} from "@/constants/financeCategories";

export function useCategoriasFinanceiras(
  tipo: "pessoal" | "grupo",
  padrao: readonly CategoriaOpcao[],
) {
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([...padrao]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    categoriasApi.listar(tipo).then(({ data }) => {
      if (!ativo) return;
      setCategorias(mesclarCategorias(padrao, data.map(({ nome }) => nome)));
      setErro(null);
    }).catch((falha: unknown) => {
      if (ativo) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as categorias.");
      }
    });

    return () => {
      ativo = false;
    };
  }, [padrao, tipo]);

  return { categorias, erro };
}
