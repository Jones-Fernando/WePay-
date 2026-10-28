import { Redirect } from "expo-router";

/** @deprecated Escolha um grupo antes de criar uma despesa compartilhada. */
export default function LegacyNovaDespesaGrupo() {
  return <Redirect href="/(main)/group" />;
}
