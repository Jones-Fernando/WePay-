import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { categoriasApi } from "@/services/api";
import type { Categoria } from "@/types/api";
import { Alert } from "@/services/feedback";
import { ICONES_CATEGORIA } from "@/constants/financeCategories";
import { IconeCategoria } from "@/components/IconeCategoria";
import { useFieldFocus } from "@/hooks/useFieldFocus";

type TipoCategoria = Categoria["tipo"];

const TIPOS: { valor: TipoCategoria; rotulo: string }[] = [
  { valor: "pessoal", rotulo: "Pessoal" },
  { valor: "grupo", rotulo: "Grupo" },
  { valor: "ambos", rotulo: "Ambos" },
];

export default function CategoriasScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [categoriaEditada, setCategoriaEditada] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("pessoal");
  const [icone, setIcone] = useState<string>("📌");
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const { focusedField, focusHandlers } = useFieldFocus();
  const iconesDisponiveis =
    categoriaEditada?.icone &&
    !ICONES_CATEGORIA.some((opcao) => opcao === categoriaEditada.icone)
      ? [categoriaEditada.icone, ...ICONES_CATEGORIA]
      : ICONES_CATEGORIA;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await categoriasApi.listar();
      setCategorias(resposta.data);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as categorias.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void carregar();
  }, [carregar]));

  function abrirModal(categoria?: Categoria) {
    setCategoriaEditada(categoria ?? null);
    setNome(categoria?.nome ?? "");
    setTipo(categoria?.tipo ?? "pessoal");
    setIcone(categoria?.icone ?? "📌");
    setErro(null);
    setModalVisivel(true);
  }

  async function salvar() {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Informe o nome da categoria.");
      return;
    }
    if (nomeLimpo.length > 100) {
      setErro("O nome deve ter no máximo 100 caracteres.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      if (categoriaEditada) {
        await categoriasApi.atualizar(
          categoriaEditada.id,
          nomeLimpo,
          tipo,
          icone,
        );
      } else {
        await categoriasApi.criar(nomeLimpo, tipo, icone);
      }
      setModalVisivel(false);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a categoria.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarRemocao(categoria: Categoria) {
    if (categoria.quantidade_despesas > 0) return;
    Alert.alert(
      "Excluir categoria",
      `Deseja excluir "${categoria.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => void remover(categoria),
        },
      ],
    );
  }

  async function remover(categoria: Categoria) {
    if (categoria.quantidade_despesas > 0) return;
    setRemovendoId(categoria.id);
    setErro(null);
    try {
      await categoriasApi.deletar(categoria.id);
      setCategorias((atuais) => atuais.filter((item) => item.id !== categoria.id));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível excluir a categoria.");
    } finally {
      setRemovendoId(null);
    }
  }

  function renderCategoria(categoria: Categoria) {
    const padrao = categoria.origem === "padrao";
    const usada = categoria.quantidade_despesas > 0;
    return (
      <View key={categoria.id} style={styles.card}>
        <View style={styles.categoryIcon}>
          <IconeCategoria icone={categoria.icone || "📌"} tamanho={24} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{categoria.nome}</Text>
          <Text style={styles.categoryType}>
            {padrao ? "Padrão" : "Personalizada"} ·{" "}
            {TIPOS.find((item) => item.valor === categoria.tipo)?.rotulo ?? categoria.tipo}
          </Text>
          {usada && (
            <Text style={styles.categoryUsage}>
              Em uso · {categoria.quantidade_despesas} despesa(s)
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Editar ${categoria.nome}`}
            onPress={() => abrirModal(categoria)}
            style={styles.action}
          >
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${categoria.nome}`}
            disabled={usada || removendoId === categoria.id}
            onPress={() => confirmarRemocao(categoria)}
            style={styles.action}
          >
            {removendoId === categoria.id
              ? <ActivityIndicator color={Cores.textoNegativo} />
              : <Text style={[styles.deleteText, usada && styles.disabledText]}>Excluir</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categorias</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Adicionar categoria"
          style={styles.addButton}
          onPress={() => abrirModal()}
        >
          <Text style={styles.addText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        Edite nomes e ícones. Categorias vinculadas a despesas não podem ser excluídas.
      </Text>
      {erro && !modalVisivel && <Text accessibilityRole="alert" style={styles.error}>{erro}</Text>}

      {carregando ? (
        <ActivityIndicator color={Cores.textoPositivo} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionTitle}>Padrão · Pessoal</Text>
          {categorias
            .filter((item) => item.origem === "padrao" && item.tipo === "pessoal")
            .map(renderCategoria)}
          <Text style={styles.sectionTitle}>Padrão · Grupo</Text>
          {categorias
            .filter((item) => item.origem === "padrao" && item.tipo === "grupo")
            .map(renderCategoria)}
          {categorias.some((item) => item.origem === "padrao" && item.tipo === "ambos") && (
            <>
              <Text style={styles.sectionTitle}>Padrão · Pessoal e grupo</Text>
              {categorias
                .filter((item) => item.origem === "padrao" && item.tipo === "ambos")
                .map(renderCategoria)}
            </>
          )}
          <Text style={styles.sectionTitle}>Personalizadas</Text>
          {!categorias.some((item) => item.origem === "personalizada") && (
            <Text style={styles.empty}>
              Você ainda não criou categorias personalizadas.
            </Text>
          )}
          {categorias
            .filter((item) => item.origem === "personalizada")
            .map(renderCategoria)}
        </ScrollView>
      )}

      <Modal
        visible={modalVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!salvando) setModalVisivel(false);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {categoriaEditada ? "Editar categoria" : "Nova categoria"}
            </Text>
            <TextInput
              style={[
                styles.input,
                focusedField === "nome" && styles.focusedField,
              ]}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome da categoria"
              placeholderTextColor={Cores.placeholder}
              maxLength={100}
              editable={!salvando}
              {...focusHandlers("nome")}
            />
            <Text style={styles.typeLabel}>Ícone</Text>
            <ScrollView
              style={styles.iconScroll}
              contentContainerStyle={styles.iconGrid}
              showsVerticalScrollIndicator
            >
              {iconesDisponiveis.map((opcao) => (
                <TouchableOpacity
                  key={opcao}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ícone ${opcao}`}
                  accessibilityState={{ selected: icone === opcao }}
                  style={[
                    styles.iconOption,
                    icone === opcao && styles.iconOptionActive,
                  ]}
                  onPress={() => setIcone(opcao)}
                  disabled={salvando}
                >
                  <IconeCategoria icone={opcao} tamanho={24} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.typeLabel}>Disponível para</Text>
            <View style={styles.typeOptions}>
              {TIPOS.map((item) => (
                <TouchableOpacity
                  key={item.valor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tipo === item.valor }}
                  style={[styles.typeOption, tipo === item.valor && styles.typeOptionActive]}
                  onPress={() => setTipo(item.valor)}
                  disabled={salvando || Boolean(
                    categoriaEditada && categoriaEditada.quantidade_despesas > 0
                  )}
                >
                  <Text style={[styles.typeText, tipo === item.valor && styles.typeTextActive]}>
                    {item.rotulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {categoriaEditada?.quantidade_despesas ? (
              <Text style={styles.categoryUsage}>
                O tipo não pode ser alterado enquanto houver despesas vinculadas.
              </Text>
            ) : null}
            {erro && modalVisivel && <Text accessibilityRole="alert" style={styles.error}>{erro}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={salvando}
                onPress={() => setModalVisivel(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                disabled={salvando}
                onPress={() => void salvar()}
              >
                {salvando
                  ? <ActivityIndicator color={Cores.textoSobreMarca} />
                  : <Text style={styles.saveText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Cores.fundo },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  backText: { color: Cores.texto, fontSize: 30, lineHeight: 34 },
  title: { color: Cores.texto, fontSize: 18, fontWeight: "700" },
  addButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Cores.principal,
  },
  addText: { color: Cores.textoSobrePrincipal, fontSize: 28, lineHeight: 32 },
  description: { paddingHorizontal: 18, paddingBottom: 8, color: Cores.textoSuave, fontSize: 12 },
  list: { padding: 18, paddingTop: 8, paddingBottom: 30 },
  sectionTitle: {
    color: Cores.texto,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 8,
  },
  card: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.cartaoFundo,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "transparent",
  },
  categoryInfo: { flex: 1, paddingRight: 8 },
  categoryName: { color: Cores.texto, fontSize: 14, fontWeight: "700" },
  categoryType: { color: Cores.textoSuave, fontSize: 11, marginTop: 4 },
  categoryUsage: { color: Cores.textoAvisoForte, fontSize: 10, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { padding: 7 },
  editText: { color: Cores.textoPositivoAlternativo, fontSize: 12, fontWeight: "700" },
  deleteText: { color: Cores.textoNegativo, fontSize: 12, fontWeight: "700" },
  disabledText: { color: Cores.desabilitado },
  loader: { marginTop: 48 },
  empty: { padding: 28, color: Cores.textoSuave, textAlign: "center" },
  error: {
    marginHorizontal: 18,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    color: Cores.textoErro,
    backgroundColor: Cores.superficieErro,
    fontSize: 12,
  },
  overlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: 22 },
  modal: { padding: 20, borderRadius: 18, backgroundColor: Cores.cartaoFundo },
  modalTitle: { color: Cores.texto, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    color: Cores.texto,
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  focusedField: {
    borderWidth: 2,
    borderColor: Cores.textoPositivo,
  },
  typeLabel: { color: Cores.texto, fontSize: 12, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  iconScroll: { maxHeight: 180 },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 2,
  },
  iconOption: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    margin: 3,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.cartaoFundo,
  },
  iconOptionActive: { borderColor: Cores.principalEscuro, backgroundColor: Cores.superficieVerdeSelecionada },
  typeOptions: { flexDirection: "row", gap: 6 },
  typeOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.cartaoFundo,
  },
  typeOptionActive: { borderColor: Cores.principal, backgroundColor: Cores.superficieVerdeSelecionada },
  typeText: { color: Cores.textoSuave, fontSize: 11, fontWeight: "600" },
  typeTextActive: { color: Cores.texto },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelButton: { minWidth: 85, minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { color: Cores.textoSuave, fontWeight: "700" },
  saveButton: {
    minWidth: 90,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: Cores.principalEscuro,
  },
  saveText: { color: Cores.textoSobreMarca, fontWeight: "700" },
});
