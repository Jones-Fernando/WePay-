import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type TipoCategoria = Categoria["tipo"];

const TIPOS: { valor: TipoCategoria; rotulo: string }[] = [
  { valor: "pessoal", rotulo: "Pessoal" },
  { valor: "grupo", rotulo: "Grupo" },
  { valor: "ambos", rotulo: "Ambos" },
];

export default function CategoriasScreen() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [categoriaEditada, setCategoriaEditada] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("pessoal");
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

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
        await categoriasApi.atualizar(categoriaEditada.id, nomeLimpo, tipo);
      } else {
        await categoriasApi.criar(nomeLimpo, tipo);
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
    Alert.alert(
      "Excluir categoria",
      `Deseja excluir "${categoria.nome}"? Despesas já registradas não serão alteradas.`,
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
        Categorias personalizadas ficam disponíveis nos formulários de despesas.
      </Text>

      {erro && !modalVisivel && <Text accessibilityRole="alert" style={styles.error}>{erro}</Text>}

      {carregando ? (
        <ActivityIndicator color="#00A17A" style={styles.loader} />
      ) : categorias.length === 0 ? (
        <Text style={styles.empty}>Nenhuma categoria disponível.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {categorias.map((categoria) => {
            const personalizada = categoria.usuario_id !== null;
            return (
              <View key={categoria.id} style={styles.card}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{categoria.nome}</Text>
                  <Text style={styles.categoryType}>
                    {personalizada ? "Personalizada" : "Padrão"} · {TIPOS.find((item) => item.valor === categoria.tipo)?.rotulo ?? categoria.tipo}
                  </Text>
                </View>
                {personalizada && (
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
                      onPress={() => confirmarRemocao(categoria)}
                      disabled={removendoId === categoria.id}
                      style={styles.action}
                    >
                      {removendoId === categoria.id
                        ? <ActivityIndicator color="#D24A3B" />
                        : <Text style={styles.deleteText}>Excluir</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
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
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome da categoria"
              placeholderTextColor="#8AA69E"
              maxLength={100}
              editable={!salvando}
              autoFocus
            />
            <Text style={styles.typeLabel}>Disponível para</Text>
            <View style={styles.typeOptions}>
              {TIPOS.map((item) => (
                <TouchableOpacity
                  key={item.valor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tipo === item.valor }}
                  style={[styles.typeOption, tipo === item.valor && styles.typeOptionActive]}
                  onPress={() => setTipo(item.valor)}
                  disabled={salvando}
                >
                  <Text style={[styles.typeText, tipo === item.valor && styles.typeTextActive]}>
                    {item.rotulo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
  },
  backText: { color: "#0B3B33", fontSize: 30, lineHeight: 34 },
  title: { color: "#0B3B33", fontSize: 18, fontWeight: "700" },
  addButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#00C896",
  },
  addText: { color: "#0B3B33", fontSize: 28, lineHeight: 32 },
  description: { paddingHorizontal: 18, paddingBottom: 8, color: "#6B8F86", fontSize: 12 },
  list: { padding: 18, paddingTop: 8, paddingBottom: 30 },
  card: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    backgroundColor: "#FFFFFF",
  },
  categoryInfo: { flex: 1, paddingRight: 8 },
  categoryName: { color: "#0B3B33", fontSize: 14, fontWeight: "700" },
  categoryType: { color: "#6B8F86", fontSize: 11, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { padding: 7 },
  editText: { color: "#008A69", fontSize: 12, fontWeight: "700" },
  deleteText: { color: "#D24A3B", fontSize: 12, fontWeight: "700" },
  loader: { marginTop: 48 },
  empty: { padding: 28, color: "#6B8F86", textAlign: "center" },
  error: {
    marginHorizontal: 18,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    color: "#A72F2F",
    backgroundColor: "#FCE8E6",
    fontSize: 12,
  },
  overlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", padding: 22 },
  modal: { padding: 20, borderRadius: 18, backgroundColor: "#FFFFFF" },
  modalTitle: { color: "#0B3B33", fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 12,
    color: "#0B3B33",
  },
  typeLabel: { color: "#0B3B33", fontSize: 12, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  typeOptions: { flexDirection: "row", gap: 6 },
  typeOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E1EEE8",
    backgroundColor: "#FFFFFF",
  },
  typeOptionActive: { borderColor: "#00C896", backgroundColor: "#DDF7EE" },
  typeText: { color: "#6B8F86", fontSize: 11, fontWeight: "600" },
  typeTextActive: { color: "#0B3B33" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelButton: { minWidth: 85, minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#6B8F86", fontWeight: "700" },
  saveButton: {
    minWidth: 90,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: "#00A17A",
  },
  saveText: { color: "#FFFFFF", fontWeight: "700" },
});
