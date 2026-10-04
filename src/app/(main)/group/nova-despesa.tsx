/*
 * WEPAY — NOVA DESPESA EM GRUPO
 *
 * Funcionalidades:
 * - Descrição
 * - Valor
 * - Categoria
 * - Pagador
 * - Participantes
 * - Divisão igual
 * - Divisão por porcentagem
 * - Divisão por valores
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

type TipoDivisao =
  | "igual"
  | "porcentagem"
  | "valores";

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

export default function NovaDespesa() {
  const { groupId } = useLocalSearchParams<{
    groupId?: string;
  }>();

  const [descricao, setDescricao] =
    useState("");

  const [valor, setValor] =
    useState("");

  const [categoria, setCategoria] =
    useState("Alimentação");

  const [pagoPor, setPagoPor] =
    useState(1);

  const [tipoDivisao, setTipoDivisao] =
    useState<TipoDivisao>("igual");

  const [selecionados, setSelecionados] =
    useState<number[]>(
      participantes.map((item) => item.id)
    );

  const [percentuais, setPercentuais] =
    useState<Record<number, string>>({});

  const [valores, setValores] =
    useState<Record<number, string>>({});

  const valorNumerico = useMemo(
    () =>
      Number(valor.replace(",", ".")) || 0,
    [valor]
  );

  function alternarParticipante(
    id: number
  ) {
    setSelecionados((estado) => {
      if (estado.includes(id)) {
        return estado.filter(
          (item) => item !== id
        );
      }

      return [...estado, id];
    });
  }

  function calcularValorIgual() {
    if (!selecionados.length) {
      return 0;
    }

    return valorNumerico / selecionados.length;
  }

  function salvarDespesa() {
    const descricaoLimpa =
      descricao.trim();

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
     * Validação para porcentagens.
     */
    if (tipoDivisao === "porcentagem") {
      const totalPercentual =
        selecionados.reduce(
          (total, id) =>
            total +
            (Number(
              (percentuais[id] ?? "0")
                .replace(",", ".")
            ) || 0),
          0
        );

      if (
        Math.abs(totalPercentual - 100) >
        0.01
      ) {
        Alert.alert(
          "Atenção",
          "A soma das porcentagens deve ser 100%."
        );
        return;
      }
    }

    /*
     * Validação para valores individuais.
     */
    if (tipoDivisao === "valores") {
      const totalValores =
        selecionados.reduce(
          (total, id) =>
            total +
            (Number(
              (valores[id] ?? "0")
                .replace(",", ".")
            ) || 0),
          0
        );

      if (
        Math.abs(totalValores - valorNumerico) >
        0.01
      ) {
        Alert.alert(
          "Atenção",
          "A soma dos valores individuais deve ser igual ao valor da despesa."
        );
        return;
      }
    }

    console.log("Nova despesa:", {
      groupId,
      descricao: descricaoLimpa,
      valor: valorNumerico,
      categoria,
      pagoPor,
      tipoDivisao,
      participantes: selecionados,
    });

    Alert.alert(
      "Despesa salva",
      "A despesa foi registrada com sucesso.",
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

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              Nova despesa
            </Text>

            <Text style={styles.headerSubtitle}>
              Viagem Bahia
            </Text>
          </View>

          <View style={styles.headerSpace} />
        </View>

        <Text style={styles.label}>
          Dividir como
        </Text>

        <View style={styles.divisionContainer}>
          {[
            {
              key: "igual",
              title: "Igual",
            },
            {
              key: "porcentagem",
              title: "%",
            },
            {
              key: "valores",
              title: "Valores",
            },
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

        <Text style={styles.label}>
          Descrição
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex.: Jantar"
          placeholderTextColor={Cores.textoSuave}
          value={descricao}
          onChangeText={setDescricao}
        />

        <Text style={styles.label}>
          Valor
        </Text>

        <View style={styles.valueContainer}>
          <Text style={styles.currency}>R$</Text>

          <TextInput
            style={styles.valueInput}
            placeholder="0,00"
            placeholderTextColor={Cores.textoSuave}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>
          Pago por
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.horizontalPeople}>
            {participantes.map((pessoa) => (
              <TouchableOpacity
                key={pessoa.id}
                style={[
                  styles.payer,
                  pagoPor === pessoa.id &&
                    styles.payerActive,
                ]}
                onPress={() =>
                  setPagoPor(pessoa.id)
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {pessoa.iniciais}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.payerText,
                    pagoPor === pessoa.id &&
                      styles.payerTextActive,
                  ]}
                >
                  {pessoa.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>
          Categoria
        </Text>

        <View style={styles.categories}>
          {[
            "Alimentação",
            "Transporte",
            "Casa",
            "Lazer",
            "Assinatura",
            "Outros",
          ].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.category,
                categoria === item &&
                  styles.categoryActive,
              ]}
              onPress={() =>
                setCategoria(item)
              }
            >
              <Text
                style={[
                  styles.categoryText,
                  categoria === item &&
                    styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.participantsHeader}>
          <View>
            <Text style={styles.label}>
              Participantes
            </Text>

            <Text style={styles.helper}>
              Selecione quem participa desta despesa.
            </Text>
          </View>

          <Text style={styles.count}>
            {selecionados.length}
          </Text>
        </View>

        {participantes.map((pessoa) => {
          const ativo = selecionados.includes(
            pessoa.id
          );

          const valorIgual =
            calcularValorIgual();

          return (
            <View
              key={pessoa.id}
              style={styles.participantRow}
            >
              <TouchableOpacity
                style={styles.participantMain}
                onPress={() =>
                  alternarParticipante(
                    pessoa.id
                  )
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    ativo &&
                      styles.checkboxActive,
                  ]}
                >
                  {ativo && (
                    <Text style={styles.check}>
                      ✓
                    </Text>
                  )}
                </View>

                <Text
                  style={styles.participantName}
                >
                  {pessoa.nome}
                </Text>
              </TouchableOpacity>

              {ativo &&
                tipoDivisao === "igual" && (
                  <Text
                    style={styles.previewValue}
                  >
                    R$ {valorIgual
                      .toFixed(2)
                      .replace(".", ",")}
                  </Text>
                )}

              {ativo &&
                tipoDivisao ===
                  "porcentagem" && (
                  <TextInput
                    style={styles.smallInput}
                    placeholder="%"
                    placeholderTextColor={
                      Cores.textoSuave
                    }
                    keyboardType="decimal-pad"
                    value={
                      percentuais[pessoa.id] ??
                      ""
                    }
                    onChangeText={(texto) =>
                      setPercentuais(
                        (estado) => ({
                          ...estado,
                          [pessoa.id]:
                            texto,
                        })
                      )
                    }
                  />
                )}

              {ativo &&
                tipoDivisao ===
                  "valores" && (
                  <TextInput
                    style={styles.smallInput}
                    placeholder="R$"
                    placeholderTextColor={
                      Cores.textoSuave
                    }
                    keyboardType="decimal-pad"
                    value={
                      valores[pessoa.id] ??
                      ""
                    }
                    onChangeText={(texto) =>
                      setValores((estado) => ({
                        ...estado,
                        [pessoa.id]:
                          texto,
                      }))
                    }
                  />
                )}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={salvarDespesa}
        >
          <Text style={styles.saveButtonText}>
            Salvar despesa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>
            Cancelar
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
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  headerCenter: {
    alignItems: "center",
  },

  headerTitle: {
    color: Cores.texto,
    fontSize: 17,
    fontWeight: "700",
  },

  headerSubtitle: {
    color: Cores.textoSuave,
    fontSize: 11,
    marginTop: 2,
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

  divisionContainer: {
    flexDirection: "row",
    backgroundColor: Cores.campo,
    padding: 3,
    borderRadius: 12,
  },

  divisionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },

  divisionActive: {
    backgroundColor: Cores.texto,
  },

  divisionText: {
    color: Cores.textoSuave,
    fontWeight: "700",
  },

  divisionTextActive: {
    color: Cores.branco,
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

  horizontalPeople: {
    flexDirection: "row",
    gap: 9,
  },

  payer: {
    alignItems: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.branco,
    borderRadius: 14,
  },

  payerActive: {
    borderColor: Cores.principal,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: Cores.texto,
    fontSize: 10,
    fontWeight: "700",
  },

  payerText: {
    color: Cores.textoSuave,
    fontSize: 10,
    marginTop: 5,
    fontWeight: "600",
  },

  payerTextActive: {
    color: Cores.texto,
  },

  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  category: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  categoryActive: {
    backgroundColor: Cores.texto,
    borderColor: Cores.texto,
  },

  categoryText: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "600",
  },

  categoryTextActive: {
    color: Cores.branco,
  },

  participantsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  helper: {
    color: Cores.textoSuave,
    fontSize: 12,
    marginTop: -3,
  },

  count: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Cores.principal,
    color: Cores.texto,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "700",
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

  previewValue: {
    color: Cores.principalEscuro,
    fontSize: 12,
    fontWeight: "700",
  },

  smallInput: {
    width: 80,
    height: 38,
    backgroundColor: Cores.campo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 10,
    paddingHorizontal: 9,
    textAlign: "right",
    color: Cores.texto,
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

  cancelButton: {
    alignItems: "center",
    paddingVertical: 15,
  },

  cancelText: {
    color: Cores.textoSuave,
    fontWeight: "600",
  },
});