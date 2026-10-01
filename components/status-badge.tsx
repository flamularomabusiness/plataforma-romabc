import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusCliente, StatusPagamento } from "@/lib/types";

type Status = StatusCliente | StatusPagamento;

/**
 * "INADIMPLENTE" existe nos dois enums (StatusCliente e StatusPagamento) e
 * significa a mesma coisa nos dois — mesma entrada, mesma cor, um mapa só.
 */
const STATUS_CONFIG: Record<Status, { label: string; variant: BadgeProps["variant"]; emoji: string }> = {
  ATIVO: { label: "Ativo", variant: "success", emoji: "🟢" },
  INATIVO: { label: "Inativo", variant: "neutral", emoji: "⚪" },
  INADIMPLENTE: { label: "Inadimplente", variant: "destructive", emoji: "🔴" },
  PROJETADO: { label: "Projetado", variant: "info", emoji: "🔵" },
  PAGO: { label: "Pago", variant: "success", emoji: "🟢" },
  ATRASADO: { label: "Atrasado", variant: "warning", emoji: "🟡" },
  CANCELADO: { label: "Cancelado", variant: "neutral", emoji: "⚫" },
};

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: Status;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={cn(SIZE_CLASS[size], className)}>
      <span className="mr-1" aria-hidden>
        {config.emoji}
      </span>
      {config.label}
    </Badge>
  );
}
