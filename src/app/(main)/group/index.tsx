/*
 * WEPAY — LISTA DE GRUPOS
 *
 * Responsabilidades:
 * - Exibir os grupos do usuário
 * - Permitir pesquisa
 * - Abrir um grupo
 * - Criar novo grupo
 *
 * Nesta primeira fase usamos dados mockados.
 * Depois os dados serão carregados pelo services/api.ts.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from "react-native";
import { router } from "expo-router";

import { Cores } from "../../../constants/Cores";
import { gruposMockados } from "../../../constants/DadosMocados";

export default function ListaGrupos() {
  const [busca, setBusca] = useState("");

  /*
   * Filtra os grupos conforme o texto digitado.
   */
  const gruposFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    if (!texto) {
      return gruposMockados;
    }

    return gruposMockados.filter((grupo) =>
      grupo.nome.toLowerCase().includes(texto)
    );
  }, [busca]);

  /*
   * Abre o grupo selecionado.
   */
  function abrirGrupo(id: number) {
    router.push({
      pathname: "/(main)/group/despesas-grupo",
      params: {
        groupId: String(id),
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Seus grupos</Text>

          <Text style={styles.subtitle}>
            Gerencie suas despesas compartilhadas
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(main)/group/novo")}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar grupo"
          placeholderTextColor={Cores.textoSuave}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <FlatList
        data={gruposFiltrados}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Nenhum grupo encontrado
            </Text>

            <Text style={styles.emptyText}>
              Tente pesquisar por outro nome.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => abrirGrupo(item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.iniciais}</Text>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.nome}</Text>

              <Text style={styles.cardInfo}>
                {item.participantes} participantes
              </Text>
            </View>

            <View style={styles.cardRight}>
              <Text
                style={[
                  styles.balance,
                  item.saldo < 0
                    ? styles.negative
                    : styles.positive,
                ]}
              >
                {item.saldo < 0 ? "-" : "+"} R${" "}
                {Math.abs(item.saldo)
                  .toFixed(2)
                  .replace(".", ",")}
              </Text>

              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
    paddingHorizontal: 20,
  },

  header: {
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    color: Cores.texto,
    fontSize: 26,
    fontWeight: "700",
  },

  subtitle: {
    color: Cores.textoSuave,
    fontSize: 13,
    marginTop: 5,
  },

  addButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
  },

  addButtonText: {
    color: Cores.texto,
    fontSize: 28,
    fontWeight: "400",
    marginTop: -2,
  },

  searchContainer: {
    height: 50,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 18,
  },

  searchIcon: {
    color: Cores.textoSuave,
    fontSize: 23,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: Cores.texto,
    fontSize: 14,
  },

  list: {
    paddingBottom: 30,
  },

  card: {
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 13,
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  cardTitle: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 15,
  },

  cardInfo: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: 5,
  },

  cardRight: {
    alignItems: "flex-end",
  },

  balance: {
    fontSize: 13,
    fontWeight: "700",
  },

  positive: {
    color: Cores.principalEscuro,
  },

  negative: {
    color: Cores.negativo,
  },

  arrow: {
    color: Cores.textoSuave,
    fontSize: 23,
    marginTop: 3,
  },

  empty: {
    paddingTop: 70,
    alignItems: "center",
  },

  emptyTitle: {
    color: Cores.texto,
    fontWeight: "700",
    fontSize: 16,
  },

  emptyText: {
    color: Cores.textoSuave,
    fontSize: 13,
    marginTop: 6,
  },
});
