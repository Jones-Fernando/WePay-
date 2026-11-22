import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, showFeedback } from "@/services/feedback";

import { lerReciboComIa } from "@/services/leitorIaServico";

export default function LerRecibo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams<{
    origem?: string;
    modo?: string;
    groupId?: string;
    grupoNome?: string;
    despesaId?: string;
  }>();
  const [imagem, setImagem] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [analisando, setAnalisando] = useState(false);

  async function selecionarImagem() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso às fotos para selecionar um recibo.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets[0]) setImagem(resultado.assets[0]);
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso à câmera para fotografar o recibo.");
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets[0]) setImagem(resultado.assets[0]);
  }

  async function analisarRecibo() {
    if (!imagem) return;

    setAnalisando(true);
    try {
      const dados = await lerReciboComIa(imagem);
      showFeedback(
        "success",
        "Recibo lido",
        "Revise os dados extraídos antes de salvar.",
      );
      router.push({
        pathname: "/(main)/receipt-reader/confirmar-recibo",
        params: {
          descricao: dados.estabelecimento ?? "",
          valor: dados.valor_total?.toFixed(2).replace(".", ",") ?? "",
          data: dados.data ?? "",
          categoria: dados.categoria_sugerida ?? "Outros",
          origem: params.origem ?? "pessoal",
          modo: params.modo ?? "criar",
          groupId: params.groupId ?? "",
          grupoNome: params.grupoNome ?? "",
          despesaId: params.despesaId ?? "",
        },
      });
    } catch (erro) {
      Alert.alert(
        "Não foi possível ler o recibo",
        erro instanceof Error ? erro.message : "Tente novamente."
      );
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
            <Text style={styles.iconeVoltar}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Ler recibo</Text>
          <View style={styles.espaco} />
        </View>

        <View style={styles.card}>
          <Text style={styles.icone}>📷</Text>
          <Text style={styles.texto}>Ler recibo com IA</Text>
          <Text style={styles.subtexto}>
            Selecione uma foto do comprovante para preencher os dados automaticamente.
          </Text>

          {imagem ? <Image source={{ uri: imagem.uri }} style={styles.previa} /> : null}

          <View style={styles.botoesImagem}>
            <TouchableOpacity style={[styles.botao, styles.botaoFlex]} onPress={tirarFoto} disabled={analisando}>
              <Text style={styles.botaoTextoPrincipal}>📷 Tirar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botao, styles.botaoFlex, styles.botaoSecundario]} onPress={selecionarImagem} disabled={analisando}>
              <Text style={styles.botaoTexto}>🖼️ {imagem ? "Trocar" : "Galeria"}</Text>
            </TouchableOpacity>
          </View>
          {analisando && (
            <Text style={styles.textoAnalisando}>✨ Analisando com IA, aguarde...</Text>
          )}
          <TouchableOpacity
            style={[styles.botao, styles.botaoAnalisar, (!imagem || analisando) && styles.botaoDesabilitado]}
            onPress={analisarRecibo}
            disabled={!imagem || analisando}
          >
            {analisando
              ? <ActivityIndicator color={Cores.texto} />
              : <Text style={styles.botaoTexto}>Analisar recibo</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Cores.fundo },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 18 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Cores.cartaoFundo, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Cores.borda },
  iconeVoltar: { fontSize: 32, color: Cores.texto, lineHeight: 34, marginTop: -3 },
  titulo: { flex: 1, textAlign: "center", fontSize: 22, fontWeight: "700", color: Cores.texto },
  espaco: { width: 42 },
  card: { flex: 1, backgroundColor: Cores.cartaoFundo, borderRadius: 20, padding: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Cores.borda },
  icone: { fontSize: 48, marginBottom: 16 },
  texto: { fontSize: 18, fontWeight: "700", color: Cores.texto, textAlign: "center" },
  subtexto: { marginTop: 10, fontSize: 13, color: Cores.textoSuave, textAlign: "center", lineHeight: 20 },
  previa: { width: "100%", height: 180, resizeMode: "contain", marginTop: 20, borderRadius: 12 },
  botoesImagem: { flexDirection: "row", gap: 10, marginTop: 24 },
  botaoFlex: { flex: 1 },
  botaoSecundario: { backgroundColor: Cores.superficieVerde, borderWidth: 1, borderColor: Cores.principal },
  botao: { backgroundColor: Cores.principal, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  botaoAnalisar: { marginTop: 16, backgroundColor: Cores.superficieVerdeSelecionada, width: "100%", alignItems: "center" },
  textoAnalisando: { marginTop: 16, fontSize: 12, color: Cores.textoSuave, textAlign: "center" },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: { color: Cores.texto, fontWeight: "700" },
  botaoTextoPrincipal: { color: Cores.textoSobrePrincipal, fontWeight: "700" },
});
