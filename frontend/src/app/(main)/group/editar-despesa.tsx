import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { despesasGrupoApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import { useFieldFocus } from "@/hooks/useFieldFocus";
import type { DespesaGrupo } from "@/types/api";
import { CATEGORIAS_GRUPO } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import CalendarioData from "@/components/CalendarioData";
import { IconeCategoria } from "@/components/IconeCategoria";
import {
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToIso,
} from "@/utils/financeInput";

type CampoFormulario = "descricao" | "valor" | "data";

export default function EditarDespesaGrupo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("grupo", CATEGORIAS_GRUPO);
  const id = String(params.id ?? "");
  const groupId = String(params.groupId ?? "");
  const [despesaOriginal, setDespesaOriginal] = useState<DespesaGrupo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [observacao, setObservacao] = useState(String(params.observacao ?? ""));
  const [mostrarSeletorData, setMostrarSeletorData] = useState(false);
  const { focusedField, focusHandlers } = useFieldFocus();
  const [camposVisitados, setCamposVisitados] = useState<Record<CampoFormulario, boolean>>({
    descricao: false,
    valor: false,
    data: false,
  });
  const [erros, setErros] = useState<Record<CampoFormulario, string | null>>({
    descricao: null,
    valor: null,
    data: null,
  });

  function selecionarData(dataSelecionada: string) {
    setMostrarSeletorData(false);
    setData(dataSelecionada);
    setCamposVisitados((atuais) => ({ ...atuais, data: true }));
    setErros((atuais) => ({ ...atuais, data: validarCampo("data", dataSelecionada) }));
  }

  function validarCampo(campo: CampoFormulario, valorCampo: string): string | null {
    if (campo === "descricao") {
      return valorCampo.trim() ? null : "Informe a descrição.";
    }
    if (campo === "valor") {
      const numero = parseCurrencyInput(valorCampo);
      return Number.isFinite(numero) && numero > 0 ? null : "Informe um valor maior que zero.";
    }
    return parseDateInputToIso(valorCampo) ? null : "Utilize uma data válida no formato DD/MM/AAAA.";
  }

  function atualizarCampo(campo: CampoFormulario, valorCampo: string) {
    if (campo === "descricao") setDescricao(valorCampo);
    if (campo === "valor") setValor(valorCampo);
    if (campo === "data") setData(valorCampo);
    if (camposVisitados[campo]) {
      setErros((atuais) => ({ ...atuais, [campo]: validarCampo(campo, valorCampo) }));
    }
  }

  function visitarCampo(campo: CampoFormulario, valorCampo: string) {
    setCamposVisitados((atuais) => ({ ...atuais, [campo]: true }));
    setErros((atuais) => ({ ...atuais, [campo]: validarCampo(campo, valorCampo) }));
  }

  useFocusEffect(useCallback(() => {
    setCarregando(true);
    setErroCarregamento(null);
    setDespesaOriginal(null);
    const despesaId = Number(id);
    if (!Number.isInteger(despesaId) || despesaId <= 0) {
      setErroCarregamento("Identificador de despesa inválido.");
      setCarregando(false);
      return;
    }
    let ativo = true;
    void (async () => {
      try {
        const { data: item } = await despesasGrupoApi.buscar(despesaId);
        if (!ativo) return;
        setDespesaOriginal(item);
        setDescricao(item.descricao);
        setValor(Number(item.valor).toFixed(2).replace(".", ","));
        setData(normalizeDateInput(item.data_despesa));
        setCategoria(item.categoria || "Outros");
      } catch (erro) {
        if (ativo) setErroCarregamento(erro instanceof Error ? erro.message : "Não foi possível carregar a despesa.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [id]));

  async function salvar() {
    const numero = parseCurrencyInput(valor);
    const dataIso = parseDateInputToIso(data);
    const novosErros = {
      descricao: validarCampo("descricao", descricao),
      valor: validarCampo("valor", valor),
      data: validarCampo("data", data),
    };
    setCamposVisitados({ descricao: true, valor: true, data: true });
    setErros(novosErros);
    if (Object.values(novosErros).some(Boolean) || !dataIso) {
      return;
    }

    if (!despesaOriginal || salvando) return;
    try {
      setSalvando(true);
      await despesasGrupoApi.atualizar(Number(id), {
        descricao: descricao.trim(), valor: numero, categoria, pagador_id: despesaOriginal.pagador_id,
        data_despesa: dataIso,
        observacao: observacao.trim(),
        participantes: (despesaOriginal.divisoes || []).map((item) => item.usuario_id),
        divisao_tipo: (despesaOriginal.divisoes?.[0]?.tipo as "igual" | "porcentagem" | "valores") || "igual",
      });
      Alert.alert("Despesa atualizada", "As alterações foram salvas.", [{ text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/detalhes-despesa", params: { id, groupId } }) }]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível atualizar a despesa.");
    } finally { setSalvando(false); }
  }

  if (carregando) {
    return (
      <SafeAreaView style={[styles.container, styles.estado]}>
        <ActivityIndicator color={Cores.textoPositivo} />
      </SafeAreaView>
    );
  }

  if (erroCarregamento || !despesaOriginal) {
    return (
      <SafeAreaView style={[styles.container, styles.estado]}>
        <Text style={styles.erroCarregamento}>
          {erroCarregamento || "Não foi possível carregar a despesa."}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Text style={styles.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.conteudo}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Text style={styles.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>Editar despesa</Text>
        <Text style={styles.subtitulo}>Atualize os dados da despesa compartilhada.</Text>

        <Text style={styles.label}>Descrição</Text>
        <TextInput style={[
          styles.input,
          erros.descricao && styles.inputComErro,
          !erros.descricao && focusedField === "descricao" && styles.focusedField,
        ]} value={descricao}
          onChangeText={(texto) => atualizarCampo("descricao", texto)}
          {...focusHandlers("descricao", () => visitarCampo("descricao", descricao))}
          placeholder="Descrição" />
        {erros.descricao && <Text style={styles.erroCampo}>{erros.descricao}</Text>}

        <Text style={styles.label}>Valor total (R$)</Text>
        <TextInput style={[
          styles.input,
          erros.valor && styles.inputComErro,
          !erros.valor && focusedField === "valor" && styles.focusedField,
        ]} value={valor}
          onChangeText={(texto) => atualizarCampo("valor", texto)}
          {...focusHandlers("valor", () => visitarCampo("valor", valor))}
          keyboardType="decimal-pad" placeholder="0,00" />
        {erros.valor && <Text style={styles.erroCampo}>{erros.valor}</Text>}

        <Text style={styles.label}>Data</Text>
        <TouchableOpacity style={[styles.seletorData, erros.data && styles.inputComErro]}
          onPress={() => setMostrarSeletorData(true)} activeOpacity={0.8}>
          <Text style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}>{data || "Escolher data"}</Text>
        </TouchableOpacity>
        {erros.data && <Text style={styles.erroCampo}>{erros.data}</Text>}
        {mostrarSeletorData && (
          <CalendarioData
            value={data}
            onClose={() => setMostrarSeletorData(false)}
            onSelectDate={selecionarData}
          />
        )}

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categorias}>
          {categorias.map(({ nome, icone }) => (
            <TouchableOpacity key={nome}
              onPress={() => setCategoria(nome)}
              style={[styles.categoria, categoria === nome && styles.categoriaAtiva]}>
              <IconeCategoria icone={icone} tamanho={15} style={{ marginRight: 5 }} />
              <Text style={[styles.categoriaTexto, categoria === nome && styles.categoriaTextoAtivo]}>{nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {erroCategorias && <Text style={styles.erroCampo}>{erroCategorias}</Text>}

        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput style={[
          styles.input,
          styles.observacao,
          focusedField === "observacao" && styles.focusedField,
        ]} value={observacao}
          onChangeText={setObservacao} multiline maxLength={500}
          placeholder="Informações adicionais"
          {...focusHandlers("observacao")} />

        <TouchableOpacity style={styles.salvar} onPress={salvar} disabled={salvando}>
          <Text style={styles.salvarTexto}>{salvando ? "Salvando..." : "Salvar alterações"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelar} onPress={() => router.back()}>
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  estado: { alignItems: "center", justifyContent: "center", padding: 24 },
  erroCarregamento: { color: Cores.textoSuave, fontSize: 14, textAlign: "center", marginBottom: 20 },
  conteudo: { padding: 20, paddingBottom: 35 },
  voltar: { marginBottom: 18 },
  voltarTexto: { color: Cores.texto, fontSize: 14, fontWeight: "700" },
  titulo: { color: Cores.texto, fontSize: 24, fontWeight: "800" },
  subtitulo: { color: Cores.textoSuave, fontSize: 12, lineHeight: 19, marginTop: 5, marginBottom: 25 },
  label: { color: Cores.texto, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 5 },
  input: { minHeight: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: Cores.texto, marginBottom: 18, outlineStyle: "solid", outlineWidth: 0 },
  focusedField: { borderWidth: 2, borderColor: Cores.textoPositivo },
  inputComErro: { borderColor: Cores.negativo },
  erroCampo: { color: Cores.textoNegativo, fontSize: 12, marginTop: -12, marginBottom: 14 },
  seletorData: { height: 52, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center", marginBottom: 18 },
  textoSeletorData: { color: Cores.texto, fontSize: 14 },
  placeholderSeletorData: { color: Cores.placeholder },
  categorias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  categoria: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Cores.cartaoFundo, borderWidth: 1, borderColor: Cores.borda, borderRadius: 12 },
  categoriaAtiva: { backgroundColor: Cores.superficieVerdeSelecionada, borderColor: Cores.principal },
  categoriaTexto: { color: Cores.textoSuave, fontSize: 11, fontWeight: "600" },
  categoriaTextoAtivo: { color: Cores.texto },
  observacao: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  salvar: { minHeight: 52, backgroundColor: Cores.principal, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 5 },
  salvarTexto: { color: Cores.textoSobreAcao, fontWeight: "800" },
  cancelar: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cancelarTexto: { color: Cores.textoSuave, fontWeight: "700" },
});
