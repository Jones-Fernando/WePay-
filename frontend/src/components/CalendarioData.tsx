import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
import {
  formatDateForInput,
  parseDateInputToDate,
} from "@/utils/financeInput";

type CalendarioDataProps = {
  value: string;
  onClose: () => void;
  onSelectDate: (date: string) => void;
};

export default function CalendarioData({
  value,
  onClose,
  onSelectDate,
}: CalendarioDataProps) {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const [mesVisivel, setMesVisivel] = useState(() => {
    const selecionada = parseDateInputToDate(value) ?? new Date();
    return new Date(selecionada.getFullYear(), selecionada.getMonth(), 1);
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const primeiroDiaMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1);
  const deslocamentoDias = (primeiroDiaMes.getDay() + 6) % 7;
  const diasCalendario = Array.from({ length: 42 }, (_, indice) =>
    indice >= deslocamentoDias
      && indice < deslocamentoDias + new Date(
        mesVisivel.getFullYear(),
        mesVisivel.getMonth() + 1,
        0,
      ).getDate()
      ? new Date(
        mesVisivel.getFullYear(),
        mesVisivel.getMonth(),
        indice - deslocamentoDias + 1,
      )
      : null,
  );
  const semanasCalendario = Array.from(
    { length: 6 },
    (_, indice) => diasCalendario.slice(indice * 7, indice * 7 + 7),
  );

  const podeAvancarMes = mesVisivel.getFullYear() < hoje.getFullYear()
    || (
      mesVisivel.getFullYear() === hoje.getFullYear()
      && mesVisivel.getMonth() < hoje.getMonth()
    );
  const mesFormatado = mesVisivel.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const tituloMes = `${mesFormatado.charAt(0).toLocaleUpperCase("pt-BR")}${mesFormatado.slice(1)}`;

  function navegarMes(direcao: number) {
    setMesVisivel((mes) => new Date(mes.getFullYear(), mes.getMonth() + direcao, 1));
  }

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.calendarioOverlay}>
        <View style={styles.calendarioCard} testID="date-calendar">
          <View style={styles.calendarioTituloLinha}>
            <Text style={styles.calendarioTitulo}>Selecione a data</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.calendarioFechar}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.calendarioNavegacao}>
            <TouchableOpacity
              testID="previous-month"
              style={styles.calendarioBotaoMes}
              onPress={() => navegarMes(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarioSeta}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calendarioMes}>{tituloMes}</Text>
            <TouchableOpacity
              testID="next-month"
              style={[
                styles.calendarioBotaoMes,
                !podeAvancarMes && styles.calendarioBotaoMesDesabilitado,
              ]}
              onPress={() => podeAvancarMes && navegarMes(1)}
              disabled={!podeAvancarMes}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarioSeta}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.calendarioDiasSemana}>
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia) => (
              <Text key={dia} style={styles.calendarioDiaSemana}>{dia}</Text>
            ))}
          </View>
          <View style={styles.calendarioGrade}>
            {semanasCalendario.map((semana, indiceSemana) => (
              <View key={`semana-${indiceSemana}`} style={styles.calendarioSemana}>
                {semana.map((dia, indiceDia) => {
                  if (!dia) {
                    return (
                      <View
                        key={`vazio-${indiceSemana}-${indiceDia}`}
                        style={styles.calendarioDiaVazio}
                      />
                    );
                  }
                  const dataFormatada = formatDateForInput(dia);
                  const dataIso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
                  const ehHoje = dia.getTime() === hoje.getTime();
                  const desabilitada = dia > hoje;
                  const selecionada = value === dataFormatada;

                  return (
                    <TouchableOpacity
                      key={dataIso}
                      testID={`calendar-day-${dataIso}`}
                      accessibilityLabel={`Selecionar ${dataFormatada}`}
                      style={[
                        styles.calendarioDia,
                        ehHoje && styles.calendarioHoje,
                        desabilitada && styles.calendarioDiaDesabilitado,
                        selecionada && styles.calendarioDiaSelecionado,
                      ]}
                      onPress={() => !desabilitada && onSelectDate(dataFormatada)}
                      disabled={desabilitada}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.calendarioNumero,
                          desabilitada && styles.calendarioNumeroDesabilitado,
                          selecionada && styles.calendarioNumeroSelecionado,
                        ]}
                      >
                        {dia.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  calendarioOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calendarioCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Cores.cartaoFundo,
    borderRadius: 20,
    padding: 12,
    paddingTop: 20,
    alignSelf: "center",
  },
  calendarioTituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarioTitulo: { fontSize: 18, fontWeight: "700", color: Cores.texto },
  calendarioFechar: { fontSize: 13, fontWeight: "600", color: Cores.textoPositivo },
  calendarioNavegacao: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  calendarioBotaoMes: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: Cores.superficieVerde,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarioBotaoMesDesabilitado: { opacity: 0.4 },
  calendarioSeta: { fontSize: 28, lineHeight: 32, color: Cores.textoPositivo },
  calendarioMes: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: Cores.texto },
  calendarioDiasSemana: { flexDirection: "row", marginBottom: 2 },
  calendarioDiaSemana: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: Cores.textoSuave,
    paddingVertical: 8,
  },
  calendarioGrade: { width: "100%" },
  calendarioSemana: { flexDirection: "row", width: "100%" },
  calendarioDia: {
    width: "14.2857%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  calendarioDiaVazio: {
    width: "14.2857%",
    aspectRatio: 1,
  },
  calendarioDiaDesabilitado: { backgroundColor: Cores.fundoCampo },
  calendarioHoje: { borderWidth: 1, borderColor: Cores.principal },
  calendarioDiaSelecionado: { backgroundColor: Cores.principal, borderColor: Cores.principal },
  calendarioNumero: { fontSize: 16, color: Cores.texto },
  calendarioNumeroSelecionado: { fontWeight: "700", color: Cores.textoSobrePrincipal },
  calendarioNumeroDesabilitado: { color: Cores.texto, fontWeight: "500" },
});
