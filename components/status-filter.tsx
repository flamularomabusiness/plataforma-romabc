"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_CLIENTE, type StatusCliente } from "@/lib/types";

const STATUS_LABELS: Record<StatusCliente, string> = {
  ATIVO: "Ativos",
  INATIVO: "Inativos",
  INADIMPLENTE: "Inadimplentes",
};

export function StatusFilter({
  value,
  onStatusChange,
}: {
  value: StatusCliente | "TODOS";
  onStatusChange: (status: StatusCliente | "TODOS") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onStatusChange(v as StatusCliente | "TODOS")}>
      <SelectTrigger className="sm:w-48">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TODOS">Todos os status</SelectItem>
        {STATUS_CLIENTE.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
