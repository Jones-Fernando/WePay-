import { Redirect } from "expo-router";

/** @deprecated Abra uma despesa pela lista do grupo. */
export default function LegacyDetalhesDespesa() {
  return <Redirect href="/(main)/group" />;
}
