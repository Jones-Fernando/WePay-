import {
  formatDateForInput,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToDate,
  parseDateInputToIso,
} from "@/utils/financeInput";

describe("parseCurrencyInput", () => {
  it.each([
    ["R$ 1.234,56", 1234.56],
    ["1234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234", 1234],
  ])("parses %s", (input, expected) => {
    expect(parseCurrencyInput(input)).toBe(expected);
  });

  it.each(["", "R$", "1.2.3", "12,345", "1,23.45", "abc"])(
    "rejects malformed currency %s",
    (input) => {
      expect(parseCurrencyInput(input)).toBeNaN();
    }
  );
});

describe("date input helpers", () => {
  it.each([
    ["07/11/2026", "2026-11-07"],
    ["2026-11-07", "2026-11-07"],
  ])("normalizes %s to ISO", (input, expected) => {
    expect(parseDateInputToIso(input)).toBe(expected);
  });

  it.each(["31/04/2026", "2026-02-29", "7/11/2026", "not-a-date"])(
    "rejects invalid date %s",
    (input) => {
      expect(parseDateInputToIso(input)).toBeNull();
    }
  );

  it("converts valid dates to local Date values and formats date-picker values", () => {
    const date = parseDateInputToDate("2026-11-07");
    expect(date).not.toBeNull();
    expect(formatDateForInput(date!)).toBe("07/11/2026");
    expect(parseDateInputToDate("2026-02-29")).toBeNull();
  });

  it("normalizes valid ISO dates while preserving unrecognized receipt text", () => {
    expect(normalizeDateInput("2026-11-07")).toBe("07/11/2026");
    expect(normalizeDateInput("data desconhecida")).toBe("data desconhecida");
  });

  it("formats ISO dates consistently without timezone shifts", () => {
    expect(formatDateForDisplay("2026-11-07")).toBe("07/11/2026");
    expect(
      formatDateForDisplay("2026-11-07", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    ).toBe("07 de novembro de 2026");
    expect(formatDateForDisplay("not-a-date")).toBe("not-a-date");
  });

  it("formats database timestamps while respecting explicit timezones", () => {
    expect(formatDateTimeForDisplay("2026-11-07 13:05:18"))
      .toBe("07/11/2026 às 13:05");
    expect(formatDateTimeForDisplay("invalid timestamp")).toBe("invalid timestamp");
  });
});
