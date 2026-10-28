import React, { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { gruposApi, Grupo } from "@/services/api";

export default function ListaGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await gruposApi.listar();
      setGrupos(res.data);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível carregar os grupos.");
    } finally {
      setCarregando(false);
    }
  }

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const gruposFiltrados = grupos.filter((g) =>
    g.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  function iniciais(nome: string) {
    return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Seus grupos</Text>
          <Text style={styles.subtitle}>Gerencie suas despesas compartilhadas</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push("/(main)/group/novo")}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput style={styles.searchInput} placeholder="Pesquisar grupo" placeholderTextColor="#6B8F86" value={busca} onChangeText={setBusca} />
      </View>

      {carregando ? (
        <ActivityIndicator color="#00C896" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={gruposFiltrados}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{busca ? "Nenhum grupo encontrado" : "Você não participa de nenhum grupo"}</Text>
              <Text style={styles.emptyText}>{busca ? "Tente outro nome." : "Crie um grupo para começar."}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: "/(main)/group/despesas-grupo", params: { groupId: String(item.id), grupoNome: item.nome } })}
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{iniciais(item.nome)}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.nome}</Text>
                {item.descricao ? <Text style={styles.cardInfo}>{item.descricao}</Text> : null}
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7", paddingHorizontal: 20 },
  header: { paddingTop: 20, paddingBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#0B3B33", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#6B8F86", fontSize: 13, marginTop: 5 },
  addButton: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#00C896", justifyContent: "center", alignItems: "center" },
  addButtonText: { color: "#0B3B33", fontSize: 28, fontWeight: "400", marginTop: -2 },
  searchContainer: { height: 50, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 18 },
  searchIcon: { color: "#6B8F86", fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, color: "#0B3B33", fontSize: 14 },
  list: { paddingBottom: 30 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1EEE8", borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#00C896", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#0B3B33", fontWeight: "700", fontSize: 13 },
  cardContent: { flex: 1, marginLeft: 12 },
  cardTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 15 },
  cardInfo: { color: "#6B8F86", fontSize: 12, marginTop: 5 },
  arrow: { color: "#6B8F86", fontSize: 23 },
  empty: { paddingTop: 70, alignItems: "center" },
  emptyTitle: { color: "#0B3B33", fontWeight: "700", fontSize: 16 },
  emptyText: { color: "#6B8F86", fontSize: 13, marginTop: 6 },
});
