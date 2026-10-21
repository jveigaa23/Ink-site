const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatCents = (cents: number) => brl.format(cents / 100);

/** Aceita "1.250,00", "1250", "1250.5" etc. Retorna centavos ou null. */
export function parseMoneyToCents(input: string): number | null {
  const raw = input.trim().replace(/[R$\s]/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
