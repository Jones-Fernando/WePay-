export function formatCurrencyBRL(
  value: number | string | null | undefined,
): string {
  const amount = Number(value ?? 0);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
