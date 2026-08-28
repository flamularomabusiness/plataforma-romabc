/**
 * Máscaras aplicadas via onChange, sem dependências externas.
 */

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  let result = digits;
  if (digits.length > 2) result = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5) result = `${result.slice(0, 6)}.${digits.slice(5)}`;
  if (digits.length > 8) result = `${result.slice(0, 10)}/${digits.slice(8)}`;
  if (digits.length > 12) result = `${result.slice(0, 15)}-${digits.slice(12)}`;
  return result;
}

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  let result = digits;
  if (digits.length > 3) result = `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length > 6) result = `${result.slice(0, 7)}.${digits.slice(6)}`;
  if (digits.length > 9) result = `${result.slice(0, 11)}-${digits.slice(9)}`;
  return result;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCurrencyToNumber(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function formatCurrencyInput(value: number | string): string {
  const numeric =
    typeof value === "number" ? value : maskCurrencyToNumber(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}

export function unmaskDigits(value: string): string {
  return value.replace(/\D/g, "");
}
