import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GrauDificuldade } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  // Colunas `date` do Postgres chegam como "YYYY-MM-DD" (sem horário). O
  // construtor Date as interpreta como UTC-00:00; formatar no timezone local
  // do navegador pode "voltar" um dia quando o fuso está atrás de UTC. Como
  // não há horário associado, forçamos UTC na formatação para exibir a data
  // exata que veio do banco, independente do fuso do usuário.
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("pt-BR", somenteData ? { timeZone: "UTC" } : undefined).format(
    date
  );
}

export function formatCNPJDisplay(cnpj: string | null | undefined): string {
  if (!cnpj) return "-";
  return cnpj;
}

/** Moeda sem centavos, para os KPIs do dashboard (números grandes, foco em legibilidade). */
export function formatarMoedaDashboard(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

/** "5,73%" ou "-18,76%"; "N/A" quando não há mês anterior pra comparar. */
export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "N/A";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)}%`;
}

/** "R$ 386" ou "-R$ 22"; "N/A" quando não há mês anterior pra comparar. */
export function formatarRsCrescimento(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "N/A";
  const absoluto = formatarMoedaDashboard(Math.abs(valor));
  return valor < 0 ? `-${absoluto}` : absoluto;
}

export const GRAU_DIFICULDADE_LABELS: Record<GrauDificuldade, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

/**
 * BAIXO/MEDIO/ALTO mapeiam 1:1 para as variantes success/warning/destructive
 * do Badge, que já usam as cores #10B981/#F59E0B/#EF4444 do design system.
 */
export function getGrauDificuldadeBadgeVariant(
  grau: GrauDificuldade
): "success" | "warning" | "destructive" {
  switch (grau) {
    case "BAIXO":
      return "success";
    case "MEDIO":
      return "warning";
    case "ALTO":
      return "destructive";
  }
}
