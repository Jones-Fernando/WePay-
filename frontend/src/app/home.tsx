import { Redirect } from "expo-router";

/** @deprecated Use /(main)/home. Kept only for legacy deep links. */
export default function LegacyHome() {
  return <Redirect href="/(main)/home" />;
}
