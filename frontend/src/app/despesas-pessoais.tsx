import { Redirect } from "expo-router";

/** @deprecated Use /(main)/personal/despesas-pessoais. */
export default function LegacyDespesasPessoais() {
  return <Redirect href="/(main)/personal/despesas-pessoais" />;
}
