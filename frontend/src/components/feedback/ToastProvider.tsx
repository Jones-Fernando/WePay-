import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import {
  subscribeFeedback,
  type FeedbackNotification,
} from "@/services/feedback";

const DURACOES: Record<FeedbackNotification["type"], number> = {
  success: 3500,
  error: 7000,
  warning: 5500,
  info: 4500,
};

const ICONES: Record<
  FeedbackNotification["type"],
  keyof typeof Feather.glyphMap
> = {
  success: "check",
  error: "x-circle",
  warning: "alert-triangle",
  info: "info",
};

export function ToastProvider({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <ToastProviderContent>{children}</ToastProviderContent>
    </SafeAreaProvider>
  );
}

function ToastProviderContent({ children }: PropsWithChildren) {
  const coresTema = useAppTheme();
  const esquemaTema = useAppThemeScheme();
  const insets = useSafeAreaInsets();
  const styles = criarEstilos(coresTema);
  const [aviso, setAviso] = useState<FeedbackNotification | null>(null);

  useEffect(() => subscribeFeedback(setAviso), []);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), DURACOES[aviso.type]);
    return () => clearTimeout(timer);
  }, [aviso]);

  const cores = aviso
    ? {
        success: {
          fundo: coresTema.fundoToastSucesso,
          borda: coresTema.principalEscuro,
          contorno: coresTema.bordaDestaque,
          titulo: coresTema.textoSucesso,
          iconeFundo: coresTema.principalEscuro,
        },
        error: {
          fundo: coresTema.fundoToastErro,
          borda: coresTema.bordaErroFormulario,
          contorno: coresTema.bordaNegativoSuave,
          titulo: coresTema.textoErroPrincipal,
          iconeFundo: coresTema.bordaErroPrincipal,
        },
        warning: {
          fundo: coresTema.superficieAviso,
          borda: coresTema.bordaAviso,
          contorno: coresTema.bordaAviso,
          titulo: coresTema.textoAvisoForte,
          iconeFundo:
            esquemaTema === "dark"
              ? coresTema.bordaAviso
              : coresTema.textoAvisoForte,
        },
        info: {
          fundo: coresTema.fundoToastInfo,
          borda: coresTema.texto,
          contorno: coresTema.bordaSuave,
          titulo: coresTema.texto,
          iconeFundo: coresTema.principalEscuro,
        },
      }[aviso.type]
    : null;

  return (
    <View style={styles.root}>
      {children}
      {aviso && cores ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion={aviso.type === "error" ? "assertive" : "polite"}
          pointerEvents="box-none"
          style={[styles.overlay, { top: insets.top + 12 }]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: cores.fundo,
                borderColor: cores.contorno,
                borderLeftColor: cores.borda,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: cores.iconeFundo }]}>
              <Feather
                name={ICONES[aviso.type]}
                size={17}
                color={coresTema.textoSobreMarca}
              />
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: cores.titulo }]}>
                {aviso.title}
              </Text>
              {aviso.message ? (
                <Text style={[styles.message, { color: coresTema.textoToast }]}>
                  {aviso.message}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar aviso"
              hitSlop={8}
              onPress={() => setAviso(null)}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  borderColor: cores.contorno,
                  backgroundColor: coresTema.fundoElevado,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Feather name="x" size={16} color={coresTema.fecharToast} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const criarEstilos = (cores: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 10000,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  toast: {
    width: "100%",
    maxWidth: 560,
    minHeight: 68,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 10,
    shadowColor: cores.tinta,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    flexShrink: 0,
  },
  content: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  message: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    flexShrink: 0,
  },
});
