import { Redirect } from "expo-router";

/** @deprecated A despesa de grupo exige um grupo real. */
export default function LegacyDespesasGrupo() {
  return <Redirect href="/(main)/group" />;
}
