import { formatCurrencyBRL } from "@/utils/financeFormat";

describe("formatCurrencyBRL", () => {
  it.each([
    [1234.56, "R$ 1.234,56"],
    ["25", "R$ 25,00"],
    [null, "R$ 0,00"],
    [Number.NaN, "R$ 0,00"],
  ])("formats %s", (value, expected) => {
    expect(formatCurrencyBRL(value)).toBe(expected);
  });
});
