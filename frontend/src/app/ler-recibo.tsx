import { Redirect } from "expo-router";

/** @deprecated Use o leitor de recibos integrado. */
export default function LegacyLerRecibo() {
  return <Redirect href="/(main)/receipt-reader/ler-recibo" />;
}
