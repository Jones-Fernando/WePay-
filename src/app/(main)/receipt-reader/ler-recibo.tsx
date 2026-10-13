import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { lerReciboComIa } from "@/services/leitorIaServico";

export default function LerRecibo() {
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

  async function analisarRecibo() {
    if (!imagem) return;

    setAnalisando(true);
    try {
      const dados = await lerReciboComIa(imagem);
      router.push({
        pathname: "/(main)/receipt-reader/confirmar-recibo",
        params: {
          descricao: dados.estabelecimento ?? "",
          valor: dados.valor_total?.toFixed(2).replace(".", ",") ?? "",
          data: dados.data ?? "",
          categoria: dados.categoria_sugerida ?? "Outros",
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
      <StatusBar barStyle="dark-content" />
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

          <TouchableOpacity style={styles.botao} onPress={selecionarImagem} disabled={analisando}>
            <Text style={styles.botaoTexto}>{imagem ? "Trocar imagem" : "Selecionar imagem"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botao, styles.botaoAnalisar, (!imagem || analisando) && styles.botaoDesabilitado]}
            onPress={analisarRecibo}
            disabled={!imagem || analisando}
          >
            {analisando ? <ActivityIndicator color="#0B3B33" /> : <Text style={styles.botaoTexto}>Analisar recibo</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5FBF7" },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 18 },
  botaoVoltar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E1EEE8" },
  iconeVoltar: { fontSize: 32, color: "#0B3B33", lineHeight: 34, marginTop: -3 },
  titulo: { flex: 1, textAlign: "center", fontSize: 22, fontWeight: "700", color: "#0B3B33" },
  espaco: { width: 42 },
  card: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E1EEE8" },
  icone: { fontSize: 48, marginBottom: 16 },
  texto: { fontSize: 18, fontWeight: "700", color: "#0B3B33", textAlign: "center" },
  subtexto: { marginTop: 10, fontSize: 13, color: "#6B8F86", textAlign: "center", lineHeight: 20 },
  previa: { width: "100%", height: 180, resizeMode: "contain", marginTop: 20, borderRadius: 12 },
  botao: { marginTop: 24, backgroundColor: "#00C896", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  botaoAnalisar: { marginTop: 10, backgroundColor: "#BDF3DF" },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: { color: "#0B3B33", fontWeight: "700" },
});
