/*
 * WEPAY — EDITAR DESPESA EM GRUPO
 *
 * Permite alterar:
 * - descrição
 * - valor
 * - categoria
 * - pagador
 * - tipo de divisão
 *
 * Depois da integração com a API,
 * a alteração recalculará os saldos.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Cores } from "../../../constants/Cores";

type TipoDivisao = "igual" | "porcentagem" | "valores";

type Participante = {
  id: number;
  nome: string;
  iniciais: string;
};

const participantes: Participante[] = [
  { id: 1, nome: "Você", iniciais: "VC" },
  { id: 2, nome: "Rafael", iniciais: "RA" },
  { id: 3, nome: "Bruno", iniciais: "BR" },
  { id: 4, nome: "Laura", iniciais: "LA" },
];

export default function EditarDespesa() {
  const { id, groupId } = useLocalSearchParams<{
    id?: string;
    groupId?: string;
  }>();

  const [descricao, setDescricao] =
    useState("Jantar na orla");

  const [valor, setValor] = useState("186,00");

  const [categoria, setCategoria] =
    useState("Alimentação");

  const [pagoPor, setPagoPor] =
    useState("Rafael");

  const [tipoDivisao, setTipoDivisao] =
    useState<TipoDivisao>("igual");

  const [selecionados, setSelecionados] =
    useState<number[]>([1, 2, 3, 4]);

  const [valoresIndividuais, setValoresIndividuais] =
    useState<Record<number, string>>({});

  const valorNumerico = useMemo(
    () => Number(valor.replace(",", ".")) || 0,
    [valor]
  );

  function alternarParticipante(idParticipante: number) {
    setSelecionados((estado) => {
      if (estado.includes(idParticipante)) {
        return estado.filter(
          (item) => item !== idParticipante
        );
      }

      return [...estado, idParticipante];
    });
  }

  function salvarAlteracao() {
    const descricaoLimpa = descricao.trim();

    if (!descricaoLimpa) {
      Alert.alert(
        "Atenção",
        "Digite a descrição da despesa."
      );
      return;
    }

    if (valorNumerico <= 0) {
      Alert.alert(
        "Atenção",
        "Digite um valor válido."
      );
      return;
    }

    if (!selecionados.length) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um participante."
      );
      return;
    }

    /*
     * Validação específica para divisão por valores.
     */
    if (tipoDivisao === "valores") {
      const soma = selecionados.reduce(
        (total, participanteId) =>
          total +
          (Number(
            (valoresIndividuais[participanteId] ?? "0")
              .replace(",", ".")
          ) || 0),
        0
      );

      if (Math.abs(soma - valorNumerico) > 0.01) {
        Alert.alert(
          "Atenção",
          "A soma dos valores individuais deve ser igual ao valor total."
        );
        return;
      }
    }

    console.log("Editar despesa:", {
      id,
      groupId,
      descricao: descricaoLimpa,
      valor: valorNumerico,
      categoria,
      pagoPor,
      tipoDivisao,
      participantes: selecionados,
    });

    Alert.alert(
      "Despesa atualizada",
      "As alterações foram salvas.",
      [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Editar despesa
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.label}>Descrição</Text>

        <TextInput
          style={styles.input}
          value={descricao}
          onChangeText={setDescricao}
        />

        <Text style={styles.label}>Valor</Text>

        <View style={styles.valueContainer}>
          <Text style={styles.currency}>R$</Text>

          <TextInput
            style={styles.valueInput}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>Categoria</Text>

        <View style={styles.rowWrap}>
          {[
            "Alimentação",
            "Transporte",
            "Casa",
            "Lazer",
            "Outros",
          ].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.pill,
                categoria === item &&
                  styles.pillActive,
              ]}
              onPress={() => setCategoria(item)}
            >
              <Text
                style={[
                  styles.pillText,
                  categoria === item &&
                    styles.pillTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Pago por</Text>

        <View style={styles.rowWrap}>
          {participantes.map((pessoa) => (
            <TouchableOpacity
              key={pessoa.id}
              style={[
                styles.payer,
                pagoPor === pessoa.nome &&
                  styles.payerActive,
              ]}
              onPress={() => setPagoPor(pessoa.nome)}
            >
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarText}>
                  {pessoa.iniciais}
                </Text>
              </View>

              <Text
                style={[
                  styles.payerText,
                  pagoPor === pessoa.nome &&
                    styles.payerTextActive,
                ]}
              >
                {pessoa.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Dividir como</Text>

        <View style={styles.divisionContainer}>
          {[
            { key: "igual", title: "Igual" },
            { key: "porcentagem", title: "%" },
            { key: "valores", title: "Valores" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.divisionButton,
                tipoDivisao === item.key &&
                  styles.divisionActive,
              ]}
              onPress={() =>
                setTipoDivisao(
                  item.key as TipoDivisao
                )
              }
            >
              <Text
                style={[
                  styles.divisionText,
                  tipoDivisao === item.key &&
                    styles.divisionTextActive,
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Participantes</Text>

        {participantes.map((pessoa) => {
          const ativo = selecionados.includes(
            pessoa.id
          );

          return (
            <View key={pessoa.id} style={styles.participantRow}>
              <TouchableOpacity
                style={styles.participantMain}
                onPress={() =>
                  alternarParticipante(pessoa.id)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    ativo && styles.checkboxActive,
                  ]}
                >
                  {ativo && (
                    <Text style={styles.check}>
                      ✓
                    </Text>
                  )}
                </View>

                <Text style={styles.participantName}>
                  {pessoa.nome}
                </Text>
              </TouchableOpacity>

              {tipoDivisao === "valores" && ativo && (
                <TextInput
                  style={styles.individualValue}
                  placeholder="0,00"
                  placeholderTextColor={
                    Cores.textoSuave
                  }
                  keyboardType="decimal-pad"
                  value={
                    valoresIndividuais[pessoa.id] ??
                    ""
                  }
                  onChangeText={(texto) =>
                    setValoresIndividuais((estado) => ({
                      ...estado,
                      [pessoa.id]: texto,
                    }))
                  }
                />
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={salvarAlteracao}
        >
          <Text style={styles.saveButtonText}>
            Salvar alterações
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    height: 65,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Cores.branco,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    color: Cores.texto,
    fontSize: 32,
  },

  headerTitle: {
    color: Cores.texto,
    fontSize: 17,
    fontWeight: "700",
  },

  headerSpace: {
    width: 42,
  },

  label: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: Cores.texto,
  },

  valueContainer: {
    height: 52,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  currency: {
    color: Cores.texto,
    fontWeight: "700",
    marginRight: 8,
  },

  valueInput: {
    flex: 1,
    color: Cores.texto,
  },

  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    backgroundColor: Cores.campo,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  pillActive: {
    backgroundColor: Cores.texto,
    borderColor: Cores.texto,
  },

  pillText: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "600",
  },

  pillTextActive: {
    color: Cores.branco,
  },

  payer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 14,
    backgroundColor: Cores.branco,
  },

  payerActive: {
    borderColor: Cores.principal,
  },

  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Cores.campo,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },

  smallAvatarText: {
    color: Cores.texto,
    fontSize: 9,
    fontWeight: "700",
  },

  payerText: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "600",
  },

  payerTextActive: {
    color: Cores.texto,
  },

  divisionContainer: {
    flexDirection: "row",
    backgroundColor: Cores.campo,
    padding: 3,
    borderRadius: 12,
  },

  divisionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 9,
  },

  divisionActive: {
    backgroundColor: Cores.texto,
  },

  divisionText: {
    color: Cores.textoSuave,
    fontWeight: "700",
    fontSize: 12,
  },

  divisionTextActive: {
    color: Cores.branco,
  },

  participantRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },

  participantMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  checkboxActive: {
    backgroundColor: Cores.principal,
    borderColor: Cores.principal,
  },

  check: {
    color: Cores.texto,
    fontWeight: "700",
  },

  participantName: {
    color: Cores.texto,
    fontSize: 13,
    fontWeight: "600",
  },

  individualValue: {
    width: 85,
    height: 40,
    backgroundColor: Cores.campo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Cores.borda,
    paddingHorizontal: 10,
    color: Cores.texto,
    textAlign: "right",
  },

  saveButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  saveButtonText: {
    color: Cores.texto,
    fontWeight: "700",
  },
});