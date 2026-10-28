import { Redirect } from "expo-router";

/** @deprecated Use /(main)/personal/nova-despesa-pessoal. */
export default function LegacyNovaDespesaPessoal() {
  return <Redirect href="/(main)/personal/nova-despesa-pessoal" />;
}
