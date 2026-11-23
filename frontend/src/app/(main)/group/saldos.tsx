import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator, SafeAreaView, ScrollView, View, Text,
  TouchableOpacity, StyleSheet, StatusBar,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { notificacoesApi, saldosApi } from "@/services/api";
import { useUsuario } from "@/contexts/UsuarioContext";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { Alert } from "@/services/feedback";

export default function SaldosGrupo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const groupId = String(params.groupId ?? "");
  const grupoNome = String(params.grupoNome ?? "Meu grupo");
  const { usuario } = useUsuario();
  const [saldos, setSaldos] = useState<{
    id: string;
    devedorId: string;
    credorId: string;
    nome: string;
    direcao: string;
    valor: number;
    pixChave: string | null;
  }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setCarregando(true);
    if (!groupId || Number(groupId) <= 0 || !usuario) {
      setSaldos([]);
      setCarregando(false);
      return;
    }
    let ativo = true;
    void (async () => {
      try {
        const { data } = await saldosApi.obter(Number(groupId));
        if (!ativo) return;
        const meuId = Number(usuario.id);
        setSaldos(data.dividas_simplificadas.filter((item) => item.devedor_id === meuId || item.credor_id === meuId).map((item, indice) => ({
          id: String(indice), devedorId: String(item.devedor_id), credorId: String(item.credor_id),
          nome: item.devedor_id === meuId ? item.credor : item.devedor,
          direcao: item.devedor_id === meuId ? "Você deve para" : "deve para você",
          valor: Number(item.valor),
          pixChave: item.devedor_id === meuId ? item.chave_pix ?? null : null,
        })));
      } catch (erro) {
        if (ativo) Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os saldos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [groupId, usuario]));

  const aReceber = saldos
    .filter((s) => s.credorId === usuario?.id)
    .reduce((total, s) => total + s.valor, 0);

  const aPagar = saldos
    .filter((s) => s.devedorId === usuario?.id)
    .reduce((total, s) => total + s.valor, 0);

  function registrarPagamento(item: (typeof saldos)[number]) {
    router.push({
      pathname: "/(main)/group/registrar-pagamento",
      params: {
        groupId,
        grupoNome,
        participanteId: item.credorId,
        participanteNome: item.nome,
        valor: item.valor.toFixed(2).replace(".", ","),
      },
    });
  }

  async function enviarCobranca(item: (typeof saldos)[number]) {
    if (cobrandoId) return;
    setCobrandoId(item.devedorId);
    try {
      await notificacoesApi.cobrar(Number(groupId), Number(item.devedorId));
      Alert.alert(
        "Cobrança enviada",
        `Um lembrete de ${formatCurrencyBRL(item.valor)} foi enviado para ${item.nome}.`,
      );
    } catch (erro) {
      Alert.alert(
        "Não foi possível enviar",
        erro instanceof Error
          ? erro.message
          : "Tente novamente mais tarde.",
      );
    } finally {
      setCobrandoId(null);
    }
  }

  function confirmarCobranca(item: (typeof saldos)[number]) {
    Alert.alert(
      "Enviar lembrete de cobrança?",
      `Enviar uma notificação privada para ${item.nome} sobre o saldo de ${formatCurrencyBRL(item.valor)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: () => void enviarCobranca(item),
        },
      ],
    );
  }

  async function copiarChavePix(chave: string) {
    try {
      await Clipboard.setStringAsync(chave);
      Alert.alert(
        "Chave Pix copiada",
        "Abra o aplicativo do seu banco e cole a chave na área Pix.",
      );
    } catch (erro) {
      Alert.alert(
        "Não foi possível copiar",
        erro instanceof Error
          ? erro.message
          : "Tente novamente ou copie a chave manualmente.",
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.voltar}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Saldos do grupo</Text>
        <Text style={styles.subtitulo}>{grupoNome}</Text>

        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.rotulo}>Você tem a receber</Text>
            <Text style={styles.positivo}>
              {formatCurrencyBRL(aReceber)}
            </Text>
          </View>
          <View style={styles.separador} />
          <View style={styles.resumoItem}>
            <Text style={styles.rotulo}>Você tem a pagar</Text>
            <Text style={styles.negativo}>
              {formatCurrencyBRL(aPagar)}
            </Text>
          </View>
        </View>

        <Text style={styles.secao}>Pendências</Text>

        {carregando ? (
          <ActivityIndicator color={Cores.textoPositivo} style={styles.estado} />
        ) : saldos.length === 0 ? (
          <Text style={styles.vazio}>Não há pendências neste grupo.</Text>
        ) : saldos.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {item.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </Text>
            </View>

            <View style={styles.dados}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.direcao}>{item.direcao}</Text>
              <Text style={styles.valor}>
                {formatCurrencyBRL(item.valor)}
              </Text>
            </View>

            {item.devedorId === usuario?.id ? (
              <View style={styles.acoesDevedor}>
                {item.pixChave ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Copiar chave Pix do credor"
                    style={styles.botaoPix}
                    onPress={() => {
                      const chave = item.pixChave;
                      if (chave) void copiarChavePix(chave);
                    }}
                  >
                    <Text style={styles.botaoPixTexto}>Copiar Pix</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.semPix}>Sem chave Pix</Text>
                )}
                <TouchableOpacity
                  style={styles.botaoPagar}
                  onPress={() => registrarPagamento(item)}
                >
                  <Text style={styles.botaoPagarTexto}>Registrar</Text>
                </TouchableOpacity>
              </View>
            ) : item.credorId === usuario?.id ? (
              <TouchableOpacity
                style={[
                  styles.botaoCobrar,
                  cobrandoId === item.devedorId && styles.botaoDesabilitado,
                ]}
                disabled={cobrandoId !== null}
                onPress={() => confirmarCobranca(item)}
              >
                {cobrandoId === item.devedorId ? (
                  <ActivityIndicator size="small" color={Cores.textoSobreMarca} />
                ) : (
                  <Text style={styles.botaoCobrarTexto}>Cobrar</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { color: Cores.texto, fontSize: 14, fontWeight: "700", marginBottom: 20, fontFamily: "normal" },
  titulo: { color: Cores.texto, fontSize: 24, fontWeight: "800", fontFamily: "normal" },
  subtitulo: { color: Cores.textoSuave, fontSize: 12, marginTop: 5, fontFamily: "normal" },
  resumo: { backgroundColor: Cores.superficieMarca, borderRadius: 18, padding: 17, marginTop: 22, marginBottom: 26 },
  resumoItem: { paddingVertical: 8 },
  rotulo: { color: Cores.textoSuaveSobreMarca, fontSize: 11, fontFamily: "normal" },
  positivo: { color: Cores.textoPositivoSaldo, fontSize: 23, fontWeight: "800", marginTop: 5, fontFamily: "normal" },
  negativo: { color: Cores.textoNegativoSaldo, fontSize: 23, fontWeight: "800", marginTop: 5, fontFamily: "normal" },
  separador: { height: 1, backgroundColor: Cores.bordaDestaque, marginVertical: 8 },
  secao: { color: Cores.texto, fontSize: 17, fontWeight: "800", marginBottom: 13, fontFamily: "normal" },
  estado: { marginTop: 16 },
  vazio: { color: Cores.textoSuave, textAlign: "center", paddingVertical: 28, fontFamily: "normal" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Cores.cartaoFundo, borderRadius: 15, borderWidth: 1, borderColor: Cores.borda, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: Cores.superficieVerdeSelecionada, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarTexto: { color: Cores.textoSucesso, fontSize: 11, fontWeight: "800", fontFamily: "normal" },
  dados: { flex: 1 },
  nome: { color: Cores.texto, fontSize: 12, fontWeight: "800", fontFamily: "normal" },
  direcao: { color: Cores.textoSuave, fontSize: 10, marginTop: 4, fontFamily: "normal" },
  valor: { color: Cores.texto, fontSize: 13, fontWeight: "800", marginTop: 5, fontFamily: "normal" },
  botaoPagar: { backgroundColor: Cores.superficieVerdeSelecionada, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, marginLeft: 6 },
  botaoPagarTexto: { color: Cores.textoPositivo, fontSize: 10, fontWeight: "800", fontFamily: "normal" },
  acoesDevedor: { alignItems: "flex-end", gap: 6, marginLeft: 6 },
  botaoPix: { backgroundColor: Cores.superficieVerde, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10 },
  botaoPixTexto: { color: Cores.textoPositivo, fontSize: 10, fontWeight: "800", fontFamily: "normal" },
  semPix: { color: Cores.textoSuave, fontSize: 9, fontFamily: "normal" },
  botaoCobrar: { backgroundColor: Cores.principalEscuro, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginLeft: 6 },
  botaoCobrarTexto: { color: Cores.textoSobreMarca, fontSize: 10, fontWeight: "800", fontFamily: "normal" },
  botaoDesabilitado: { opacity: 0.6 },
  aviso: { color: Cores.textoSuave, fontSize: 10, lineHeight: 16, marginTop: 15, textAlign: "center" },
});
